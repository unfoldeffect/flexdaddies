// Talks to the store app's accounts server (mobile-api/). Nothing here
// touches the phone's storage or the screen, so it can be tested on its own.

export type Account = { id: string; email: string; name: string; weightUnit: 'lbs' | 'kg' };
export type Session = { token: string; account: Account };

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; message: string; retryAfterSeconds?: number; details?: Record<string, unknown> };

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export const OFFLINE_MESSAGE = "Can't reach Flex Daddies. Check your connection and try again.";
export const NOT_SET_UP_MESSAGE = "Sign-in isn't switched on in this build yet.";
const TIMEOUT_MS = 12000;

/** Where the accounts server lives, or null when this build has none. */
export function apiBase(): string | null {
  const raw = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(raw) ? raw : null;
}

export const isEmail = (text: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());

/** Keeps the digits of a typed or pasted code, six at most. */
export const tidyCode = (text: string) => text.replace(/\D/g, '').slice(0, 6);

function isAccount(a: unknown): a is Account {
  const r = a as Account | null;
  return !!r && typeof r.id === 'string' && typeof r.email === 'string' && typeof r.name === 'string';
}

export function isSession(s: unknown): s is Session {
  const r = s as Session | null;
  return !!r && typeof r.token === 'string' && r.token.length > 0 && isAccount(r.account);
}

export function makeAuthApi(base: string | null, fetcher: Fetcher = (url, init) => fetch(url, init)) {
  async function call<T>(method: string, path: string, body?: unknown, token?: string): Promise<ApiResult<T>> {
    if (!base) return { ok: false, error: 'not_set_up', message: NOT_SET_UP_MESSAGE };
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), TIMEOUT_MS);
    try {
      const res = await fetcher(`${base}${path}`, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: stop.signal,
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (res.ok && data) return { ok: true, data: data as T };
      return {
        ok: false,
        error: typeof data?.error === 'string' ? data.error : 'server_error',
        message: typeof data?.message === 'string' ? data.message : 'Something went wrong. Try again.',
        ...(typeof data?.retryAfterSeconds === 'number' ? { retryAfterSeconds: data.retryAfterSeconds } : {}),
        ...(data && res.status === 409 ? { details: data } : {}),
      };
    } catch {
      return { ok: false, error: 'offline', message: OFFLINE_MESSAGE };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    /** Asks for a code. `devCode` only comes back from a test server. */
    start: (email: string) => call<{ ok: true; devCode?: string }>('POST', '/auth/email/start', { email }),
    verify: (email: string, code: string) =>
      call<{ token: string; user: Account; isNew: boolean }>('POST', '/auth/email/verify', { email, code }),
    me: (token: string) => call<{ user: Account }>('GET', '/me', undefined, token),
    update: (token: string, patch: { name?: string; weightUnit?: 'lbs' | 'kg' }) =>
      call<{ user: Account }>('PATCH', '/me', patch, token),
    signOut: (token: string) => call<{ ok: true }>('POST', '/auth/signout', undefined, token),
    deleteAccount: (token: string) => call<{ ok: true }>('DELETE', '/me', undefined, token),
    /** Partner sync: who this account is linked with, and sessions waiting from them. */
    partnerSessions: (token: string) =>
      call<{ partner: { name: string } | null; sessions: { id: string }[] }>('GET', '/partner/sessions', undefined, token),
    partnerReceived: (token: string, ids: string[]) =>
      call<{ ok: true }>('POST', '/partner/sessions/received', { ids }, token),
    partnerSend: (token: string, session: unknown) => call<{ ok: true }>('POST', '/partner/sessions', session, token),
    partnerInvite: (token: string) => call<{ code: string; expiresAt: number }>('POST', '/partner/invite', undefined, token),
    partnerJoin: (token: string, code: string) =>
      call<{ partner: { name: string } | null }>('POST', '/partner/join', { code }, token),
    partnerUnlink: (token: string) => call<{ partner: null }>('DELETE', '/partner', undefined, token),
    /** The account's saved copy of the phone's data (rev 0 and null when there is none). */
    getData: (token: string) => call<{ rev: number; data: unknown }>('GET', '/data', undefined, token),
    /** Saves on top of copy `baseRev`. Error "newer_copy" carries the newer one in `details`. */
    putData: (token: string, baseRev: number, data: unknown) =>
      call<{ ok: true; rev: number }>('PUT', '/data', { baseRev, data }, token),
  };
}

export type AuthApi = ReturnType<typeof makeAuthApi>;
