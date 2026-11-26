// The store app's accounts: sign in with a 6-digit code sent by email,
// stay signed in, set a name and units, keep a saved copy of the phone's data,
// sign out, delete the account.
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
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
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

/** The most one account's saved copy may hold, before squeezing (years of daily workouts). */
export const MAX_DATA_BYTES = 8_000_000;

async function gzip(text: string): Promise<string> {
  const squeezed = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(squeezed).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function gunzip(base64: string): Promise<string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const opened = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(opened).text();
}

type DataRow = { rev: number; data_gz: string };

async function savedCopy(env: Env, userId: string) {
  const row = await env.DB.prepare('SELECT rev, data_gz FROM user_data WHERE user_id = ?')
    .bind(userId)
    .first<DataRow>();
  if (!row) return { rev: 0, data: null as unknown };
  return { rev: row.rev, data: JSON.parse(await gunzip(row.data_gz)) as unknown };
}

/** Saves the phone's data, but only on top of the copy that phone last saw. */
async function saveCopy(request: Request, env: Env, user: UserRow, now: number): Promise<Response> {
  const text = await request.text();
  if (text.length > MAX_DATA_BYTES) return fail(413, 'too_big', 'That is more than one account can hold.');
  let body: { baseRev?: unknown; data?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, 'bad_data', 'That could not be read.');
  }
  const { baseRev, data } = body ?? {};
  if (!Number.isInteger(baseRev) || !data || typeof data !== 'object' || Array.isArray(data)) {
    return fail(400, 'bad_data', 'That could not be read.');
  }
  const current = await env.DB.prepare('SELECT rev FROM user_data WHERE user_id = ?')
    .bind(user.id)
    .first<{ rev: number }>();
  const rev = current?.rev ?? 0;
  if (baseRev !== rev) {
    // Another phone saved in between: hand back the newer copy to merge.
    return json(409, { error: 'newer_copy', message: 'Another phone saved first.', ...(await savedCopy(env, user.id)) });
  }
  const dataText = JSON.stringify(data);
  const squeezed = await gzip(dataText);
  // The "WHERE rev" guards against two saves landing at the same moment.
  await env.DB.prepare(
    `INSERT INTO user_data (user_id, rev, data_gz, bytes, updated_at) VALUES (?, 1, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET rev = user_data.rev + 1, data_gz = excluded.data_gz,
       bytes = excluded.bytes, updated_at = excluded.updated_at WHERE user_data.rev = ?`,
  )
    .bind(user.id, squeezed, dataText.length, now, rev)
    .run();
  const after = await env.DB.prepare('SELECT rev FROM user_data WHERE user_id = ?')
    .bind(user.id)
    .first<{ rev: number }>();
  if (after?.rev !== rev + 1) {
    return json(409, { error: 'newer_copy', message: 'Another phone saved first.', ...(await savedCopy(env, user.id)) });
  }
  return json(200, { ok: true, rev: rev + 1 });
}

// ---------- Partner sync ----------

export const INVITE_MINUTES = 15;
export const MAX_JOIN_TRIES_PER_HOUR = 10;
const MAX_SESSION_BYTES = 200_000;
const MAX_WAITING_SESSIONS = 200;

async function partnerOf(env: Env, userId: string): Promise<{ id: string; name: string } | null> {
  return env.DB.prepare(
    `SELECT u.id, u.name FROM partner_links l
       JOIN users u ON u.id = CASE WHEN l.user_a = ? THEN l.user_b ELSE l.user_a END
      WHERE l.user_a = ? OR l.user_b = ?`,
  )
    .bind(userId, userId, userId)
    .first<{ id: string; name: string }>();
}

const partnerView = (p: { id: string; name: string } | null) =>
  p ? { partner: { name: p.name || 'Your partner' } } : { partner: null };

async function createInvite(env: Env, user: UserRow, now: number): Promise<Response> {
  if (await partnerOf(env, user.id)) {
    return fail(409, 'already_linked', 'You are already linked with a partner. Unlink first.');
  }
  // A few tries, in the rare case another pending invite has the same code.
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const taken = await env.DB.prepare('SELECT user_id FROM partner_invites WHERE code_hash = ? AND expires_at > ? AND user_id != ?')
      .bind(await codeHash(env, 'invite', code), now, user.id)
      .first();
    if (taken) continue;
    const expiresAt = now + INVITE_MINUTES * 60 * 1000;
    await env.DB.batch([
      env.DB.prepare('DELETE FROM partner_invites WHERE code_hash = ?').bind(await codeHash(env, 'invite', code)),
      env.DB.prepare(
        `INSERT INTO partner_invites (user_id, code_hash, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at`,
      ).bind(user.id, await codeHash(env, 'invite', code), expiresAt),
    ]);
    return json(200, { code, expiresAt });
  }
  return fail(503, 'try_again', 'Try again in a moment.');
}

async function joinPartner(request: Request, env: Env, user: UserRow, now: number): Promise<Response> {
  const raw = (await readBody(request)).code;
  const code = typeof raw === 'string' ? raw.replace(/\D/g, '') : '';
  if (await partnerOf(env, user.id)) {
    return fail(409, 'already_linked', 'You are already linked with a partner. Unlink first.');
  }
  const tries = await env.DB.prepare('SELECT window_start, tries FROM partner_tries WHERE user_id = ?')
    .bind(user.id)
    .first<{ window_start: number; tries: number }>();
  const inWindow = tries && now - tries.window_start < HOUR;
  if (inWindow && tries.tries >= MAX_JOIN_TRIES_PER_HOUR) {
    return fail(429, 'too_many', 'Too many wrong codes. Try again in an hour.');
  }
  const wrong = async (message: string) => {
    await env.DB.prepare(
      `INSERT INTO partner_tries (user_id, window_start, tries) VALUES (?, ?, 1)
       ON CONFLICT(user_id) DO UPDATE SET
         tries = CASE WHEN ? - partner_tries.window_start < ${HOUR} THEN partner_tries.tries + 1 ELSE 1 END,
         window_start = CASE WHEN ? - partner_tries.window_start < ${HOUR} THEN partner_tries.window_start ELSE ? END`,
    )
      .bind(user.id, now, now, now, now)
      .run();
    return fail(400, 'wrong_code', message);
  };
  if (code.length !== 6) return wrong("That code isn't right. Check it with your partner.");
  const invite = await env.DB.prepare('SELECT user_id, expires_at FROM partner_invites WHERE code_hash = ?')
    .bind(await codeHash(env, 'invite', code))
    .first<{ user_id: string; expires_at: number }>();
  if (!invite || invite.expires_at < now) {
    return wrong("That code isn't right, or it has run out. Ask your partner for a new one.");
  }
  if (invite.user_id === user.id) return fail(400, 'own_code', 'That is your own code. Your partner types it on their phone.');
  if (await partnerOf(env, invite.user_id)) {
    return fail(409, 'partner_taken', 'That person is already linked with someone else.');
  }
  const [a, b] = [user.id, invite.user_id].sort();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO partner_links (user_a, user_b, created_at) VALUES (?, ?, ?)').bind(a, b, now),
    env.DB.prepare('DELETE FROM partner_invites WHERE user_id IN (?, ?)').bind(user.id, invite.user_id),
    env.DB.prepare('DELETE FROM partner_tries WHERE user_id = ?').bind(user.id),
  ]);
  return json(200, partnerView(await partnerOf(env, user.id)));
}

async function unlinkPartner(env: Env, user: UserRow): Promise<Response> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM partner_sessions WHERE from_user = ? OR to_user = ?').bind(user.id, user.id),
    env.DB.prepare('DELETE FROM partner_links WHERE user_a = ? OR user_b = ?').bind(user.id, user.id),
    env.DB.prepare('DELETE FROM partner_invites WHERE user_id = ?').bind(user.id),
  ]);
  return json(200, { partner: null });
}

/** A session one phone logged for both people, left for the partner's phone to pick up. */
async function sendSession(request: Request, env: Env, user: UserRow, now: number): Promise<Response> {
  const text = await request.text();
  if (text.length > MAX_SESSION_BYTES) return fail(413, 'too_big', 'That session is too big to share.');
  let body: { id?: unknown; mine?: unknown; theirs?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, 'bad_data', 'That could not be read.');
  }
  const isObject = (x: unknown) => !!x && typeof x === 'object' && !Array.isArray(x);
  if (typeof body?.id !== 'string' || body.id.length > 80 || !isObject(body.mine) || !isObject(body.theirs)) {
    return fail(400, 'bad_data', 'That could not be read.');
  }
  const partner = await partnerOf(env, user.id);
  if (!partner) return fail(409, 'not_linked', 'You are not linked with a partner.');
  const waiting = await env.DB.prepare('SELECT COUNT(*) AS n FROM partner_sessions WHERE to_user = ?')
    .bind(partner.id)
    .first<{ n: number }>();
  if ((waiting?.n ?? 0) >= MAX_WAITING_SESSIONS) {
    return fail(429, 'partner_behind', "Your partner's phone has not picked up earlier sessions yet.");
  }
  // The id is scoped to the sender, so one account cannot overwrite another's.
  await env.DB.prepare(
    `INSERT INTO partner_sessions (id, from_user, to_user, payload, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
  )
    .bind(`${user.id}:${body.id}`, user.id, partner.id, JSON.stringify({ mine: body.mine, theirs: body.theirs }), now)
    .run();
  return json(200, { ok: true });
}

async function waitingSessions(env: Env, user: UserRow): Promise<Response> {
  const partner = await partnerOf(env, user.id);
  const found: { id: string; mine: unknown; theirs: unknown }[] = [];
  if (partner) {
    // D1 has no cursor here, so read them one at a time, oldest first.
    let after = -1;
    let lastId = '';
    for (let i = 0; i < 50; i++) {
      const row = await env.DB.prepare(
        `SELECT id, payload, created_at FROM partner_sessions
          WHERE to_user = ? AND from_user = ? AND (created_at > ? OR (created_at = ? AND id > ?))
          ORDER BY created_at, id LIMIT 1`,
      )
        .bind(user.id, partner.id, after, after, lastId)
        .first<{ id: string; payload: string; created_at: number }>();
      if (!row) break;
      after = row.created_at;
      lastId = row.id;
      const payload = JSON.parse(row.payload) as { mine: unknown; theirs: unknown };
      found.push({ id: row.id, ...payload });
    }
  }
  return json(200, { ...partnerView(partner), sessions: found });
}

async function receivedSessions(request: Request, env: Env, user: UserRow): Promise<Response> {
  const ids = (await readBody(request)).ids;
  if (!Array.isArray(ids) || ids.length > 100 || ids.some((id) => typeof id !== 'string')) {
    return fail(400, 'bad_data', 'That could not be read.');
  }
  if (ids.length) {
    await env.DB.batch(
      (ids as string[]).map((id) =>
        env.DB.prepare('DELETE FROM partner_sessions WHERE id = ? AND to_user = ?').bind(id, user.id),
      ),
    );
  }
  return json(200, { ok: true });
}

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

    const signedInRoutes = [
      'GET /me',
      'PATCH /me',
      'DELETE /me',
      'POST /auth/signout',
      'GET /data',
      'PUT /data',
      'GET /partner',
      'POST /partner/invite',
      'POST /partner/join',
      'DELETE /partner',
      'POST /partner/sessions',
      'GET /partner/sessions',
      'POST /partner/sessions/received',
    ];
    if (signedInRoutes.includes(route)) {
      const who = await signedInUser(request, env, now);
      if (!who) return fail(401, 'signed_out', 'Sign in again.');
      if (route === 'GET /me') return json(200, { user: publicUser(who.user) });
      if (route === 'PATCH /me') return await updateMe(request, env, who.user);
      if (route === 'GET /data') return json(200, await savedCopy(env, who.user.id));
      if (route === 'PUT /data') return await saveCopy(request, env, who.user, now);
      if (route === 'GET /partner') return json(200, partnerView(await partnerOf(env, who.user.id)));
      if (route === 'POST /partner/invite') return await createInvite(env, who.user, now);
      if (route === 'POST /partner/join') return await joinPartner(request, env, who.user, now);
      if (route === 'DELETE /partner') return await unlinkPartner(env, who.user);
      if (route === 'POST /partner/sessions') return await sendSession(request, env, who.user, now);
      if (route === 'GET /partner/sessions') return await waitingSessions(env, who.user);
      if (route === 'POST /partner/sessions/received') return await receivedSessions(request, env, who.user);
      if (route === 'POST /auth/signout') {
        await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(who.tokenHash).run();
        return json(200, { ok: true });
      }
      // Delete my account: the account, its saved data, every signed-in phone and any pending code.
      await env.DB.batch([
        env.DB.prepare('DELETE FROM user_data WHERE user_id = ?').bind(who.user.id),
        env.DB.prepare('DELETE FROM partner_sessions WHERE from_user = ? OR to_user = ?').bind(who.user.id, who.user.id),
        env.DB.prepare('DELETE FROM partner_links WHERE user_a = ? OR user_b = ?').bind(who.user.id, who.user.id),
        env.DB.prepare('DELETE FROM partner_invites WHERE user_id = ?').bind(who.user.id),
        env.DB.prepare('DELETE FROM partner_tries WHERE user_id = ?').bind(who.user.id),
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
