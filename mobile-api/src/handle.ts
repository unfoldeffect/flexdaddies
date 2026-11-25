// The store app's accounts: sign in with a 6-digit code sent by email,
// stay signed in, set a name and units, sign out, delete the account.
// Runs on Cloudflare Workers with a D1 database, and on a Mac for testing
// (dev-server.ts). No passwords are ever stored.

/** The small part of Cloudflare's D1 database this code uses. */
export type Statement = {
  bind: (...values: unknown[]) => Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<unknown>;
};
export type Database = {
  prepare: (sql: string) => Statement;
  batch: (statements: Statement[]) => Promise<unknown>;
};

export type Env = {
  DB: Database;
  /** Mixed into every code hash. Set as a secret when deployed. */
  CODE_PEPPER?: string;
  /** "1" on a test machine only: the code is returned to the app, and no email is sent. */
  DEV_SHOW_CODE?: string;
  /** Sends the code by email. Not set up yet; without it (and without DEV_SHOW_CODE) sign-in says so. */
  sendCode?: (email: string, code: string) => Promise<boolean>;
};

export const CODE_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
export const RESEND_WAIT_SECONDS = 30;
export const MAX_SENDS_PER_HOUR = 5;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type UserRow = { id: string; email: string; name: string; weight_unit: string };

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-max-age': '86400',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS },
  });
}
const fail = (status: number, error: string, message: string, extra: object = {}) =>
  json(status, { error, message, ...extra });

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compares two hashes without stopping early, so timing gives nothing away. */
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Six digits, every value equally likely. */
export function newCode(): string {
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  const box = new Uint32Array(1);
  do crypto.getRandomValues(box);
  while (box[0] >= limit);
  return String(box[0] % 1_000_000).padStart(6, '0');
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const codeHash = (env: Env, email: string, code: string) =>
  sha256(`${email}:${code}:${env.CODE_PEPPER ?? ''}`);

const publicUser = (u: UserRow) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  weightUnit: u.weight_unit === 'kg' ? 'kg' : 'lbs',
});

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (text.length > 4000) return {};
    const body: unknown = JSON.parse(text);
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function signedInUser(request: Request, env: Env, now: number) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || token.length > 200) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.weight_unit, s.last_seen_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
  )
    .bind(tokenHash)
    .first<UserRow & { last_seen_at: number }>();
  if (!row) return null;
  if (now - row.last_seen_at > DAY) {
    await env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?')
      .bind(now, tokenHash)
      .run();
  }
  return { user: row as UserRow, tokenHash };
}

async function startEmail(request: Request, env: Env, now: number): Promise<Response> {
  const email = normalizeEmail((await readBody(request)).email);
  if (!email) return fail(400, 'bad_email', 'Enter a valid email address.');

  const canShow = env.DEV_SHOW_CODE === '1';
  if (!canShow && !env.sendCode) {
    return fail(503, 'email_not_set_up', 'Email sign-in is not set up yet.');
  }

  const pending = await env.DB.prepare(
    'SELECT last_sent_at, window_start, sent_in_window FROM login_codes WHERE email = ?',
  )
    .bind(email)
    .first<{ last_sent_at: number; window_start: number; sent_in_window: number }>();

  let windowStart = now;
  let sentInWindow = 1;
  if (pending) {
    const wait = RESEND_WAIT_SECONDS * 1000 - (now - pending.last_sent_at);
    if (wait > 0) {
      return fail(429, 'too_soon', 'Wait a moment before asking for another code.', {
        retryAfterSeconds: Math.ceil(wait / 1000),
      });
    }
    if (now - pending.window_start < HOUR) {
      if (pending.sent_in_window >= MAX_SENDS_PER_HOUR) {
        return fail(429, 'too_many', 'Too many codes sent. Try again in an hour.');
      }
      windowStart = pending.window_start;
      sentInWindow = pending.sent_in_window + 1;
    }
  }

  const code = newCode();
  await env.DB.prepare(
    `INSERT INTO login_codes (email, code_hash, expires_at, attempts, last_sent_at, window_start, sent_in_window)
     VALUES (?, ?, ?, 0, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at,
       attempts = 0, last_sent_at = excluded.last_sent_at, window_start = excluded.window_start,
       sent_in_window = excluded.sent_in_window`,
  )
    .bind(email, await codeHash(env, email, code), now + CODE_MINUTES * 60 * 1000, now, windowStart, sentInWindow)
    .run();

  if (canShow) return json(200, { ok: true, devCode: code });
  const sent = await env.sendCode!(email, code).catch(() => false);
  if (!sent) return fail(502, 'send_failed', "The email couldn't be sent. Try again.");
  return json(200, { ok: true });
}

async function verifyEmail(request: Request, env: Env, now: number): Promise<Response> {
  const body = await readBody(request);
  const email = normalizeEmail(body.email);
  const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
  const wrong = () => fail(400, 'wrong_code', "That code isn't right. Check it and try again.");
  if (!email || code.length !== 6) return wrong();

  const pending = await env.DB.prepare(
    'SELECT code_hash, expires_at, attempts FROM login_codes WHERE email = ?',
  )
    .bind(email)
    .first<{ code_hash: string; expires_at: number; attempts: number }>();
  if (!pending) return wrong();
  if (pending.expires_at < now || pending.attempts >= MAX_ATTEMPTS) {
    await env.DB.prepare('DELETE FROM login_codes WHERE email = ?').bind(email).run();
    return fail(400, 'expired_code', 'That code has expired. Send a new one.');
  }
  if (!sameHash(pending.code_hash, await codeHash(env, email, code))) {
    await env.DB.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?')
      .bind(email)
      .run();
    return wrong();
  }

  // The code is right: use it up, find or create the account, and sign this phone in.
  await env.DB.prepare('DELETE FROM login_codes WHERE email = ?').bind(email).run();
  let user = await env.DB.prepare('SELECT id, email, name, weight_unit FROM users WHERE email = ?')
    .bind(email)
    .first<UserRow>();
  let isNew = false;
  if (!user) {
    isNew = true;
    user = { id: crypto.randomUUID(), email, name: '', weight_unit: 'lbs' };
    await env.DB.prepare('INSERT INTO users (id, email, name, weight_unit, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(user.id, user.email, user.name, user.weight_unit, now)
      .run();
  }
  const token = newToken();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), user.id, now, now)
    .run();
  return json(200, { token, user: publicUser(user), isNew });
}

async function updateMe(request: Request, env: Env, user: UserRow): Promise<Response> {
  const body = await readBody(request);
  let name = user.name;
  let unit = user.weight_unit;
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') return fail(400, 'bad_name', 'Enter your first name.');
    name = body.name.replace(/\s+/g, ' ').trim();
    if (!name || name.length > 40) return fail(400, 'bad_name', 'Enter your first name (40 letters at most).');
  }
  if (body.weightUnit !== undefined) {
    if (body.weightUnit !== 'lbs' && body.weightUnit !== 'kg') {
      return fail(400, 'bad_unit', 'Choose pounds or kilos.');
    }
    unit = body.weightUnit;
  }
  await env.DB.prepare('UPDATE users SET name = ?, weight_unit = ? WHERE id = ?')
    .bind(name, unit, user.id)
    .run();
  return json(200, { user: publicUser({ ...user, name, weight_unit: unit }) });
}

export async function handle(request: Request, env: Env, now: number = Date.now()): Promise<Response> {
  const { pathname } = new URL(request.url);
  const route = `${request.method} ${pathname.replace(/\/+$/, '') || '/'}`;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    if (route === 'GET /') return json(200, { ok: true, service: 'flex-daddies-store-app' });
    if (route === 'POST /auth/email/start') return await startEmail(request, env, now);
    if (route === 'POST /auth/email/verify') return await verifyEmail(request, env, now);

    if (route === 'GET /me' || route === 'PATCH /me' || route === 'DELETE /me' || route === 'POST /auth/signout') {
      const who = await signedInUser(request, env, now);
      if (!who) return fail(401, 'signed_out', 'Sign in again.');
      if (route === 'GET /me') return json(200, { user: publicUser(who.user) });
      if (route === 'PATCH /me') return await updateMe(request, env, who.user);
      if (route === 'POST /auth/signout') {
        await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(who.tokenHash).run();
        return json(200, { ok: true });
      }
      // Delete my account: the account, every signed-in phone and any pending code.
      await env.DB.batch([
        env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(who.user.id),
        env.DB.prepare('DELETE FROM login_codes WHERE email = ?').bind(who.user.email),
        env.DB.prepare('DELETE FROM users WHERE id = ?').bind(who.user.id),
      ]);
      return json(200, { ok: true, deleted: true });
    }
    return fail(404, 'not_found', 'Not found.');
  } catch {
    return fail(500, 'server_error', 'Something went wrong. Try again.');
  }
}
