// Sign in with Apple and Google, the server half: checking that an identity
// token really came from Apple or Google and was meant for this app. The
// buttons in the app are wired to this once the Apple and Google accounts exist.

export type Provider = 'apple' | 'google';

export type Jwk = { kid: string; kty: string; n: string; e: string; alg?: string };

export type ProviderSettings = {
  /** Who the token must be for: the app's bundle id (Apple) or its client ids (Google). */
  audiences: string[];
  /** Fetches the provider's public keys. Replaced in tests. */
  fetchKeys?: (url: string) => Promise<Jwk[]>;
};

const PROVIDERS: Record<Provider, { issuers: string[]; keysUrl: string }> = {
  apple: { issuers: ['https://appleid.apple.com'], keysUrl: 'https://appleid.apple.com/auth/keys' },
  google: {
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
    keysUrl: 'https://www.googleapis.com/oauth2/v3/certs',
  },
};

export type VerifiedIdentity = { subject: string; email: string | null; emailVerified: boolean };
export type VerifyResult = { ok: true; identity: VerifiedIdentity } | { ok: false; reason: string };

const KEY_CACHE_MS = 60 * 60 * 1000;
const keyCache = new Map<string, { at: number; keys: Jwk[] }>();

async function defaultFetchKeys(url: string): Promise<Jwk[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('keys unavailable');
  return ((await res.json()) as { keys: Jwk[] }).keys;
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
const readPart = (part: string) => JSON.parse(new TextDecoder().decode(fromBase64Url(part))) as Record<string, unknown>;

/**
 * Checks an identity token: the signature against the provider's own keys,
 * who issued it, who it is for, and that it has not run out.
 */
export async function verifyIdentityToken(
  provider: Provider,
  token: unknown,
  settings: ProviderSettings,
  now: number,
): Promise<VerifyResult> {
  const bad = (reason: string): VerifyResult => ({ ok: false, reason });
  if (typeof token !== 'string' || token.length > 6000) return bad('unreadable');
  const parts = token.split('.');
  if (parts.length !== 3) return bad('unreadable');
  let header: Record<string, unknown>;
  let claims: Record<string, unknown>;
  try {
    header = readPart(parts[0]);
    claims = readPart(parts[1]);
  } catch {
    return bad('unreadable');
  }
  // Only the algorithm both providers use. Never trust the token's own choice beyond this.
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return bad('wrong_kind');

  const { issuers, keysUrl } = PROVIDERS[provider];
  const fetchKeys = settings.fetchKeys ?? defaultFetchKeys;
  const cacheKey = `${provider}:${keysUrl}`;
  let keys = keyCache.get(cacheKey);
  const findKey = () => keys?.keys.find((k) => k.kid === header.kid && k.kty === 'RSA');
  // Providers change their keys now and then: look again if this one is unknown.
  if (!keys || now - keys.at > KEY_CACHE_MS || !findKey()) {
    try {
      keys = { at: now, keys: await fetchKeys(keysUrl) };
      if (!settings.fetchKeys) keyCache.set(cacheKey, keys);
    } catch {
      return bad('keys_unavailable');
    }
  }
  const jwk = findKey();
  if (!jwk) return bad('unknown_key');

  let valid = false;
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      fromBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return bad('bad_signature');
  }
  if (!valid) return bad('bad_signature');

  if (typeof claims.iss !== 'string' || !issuers.includes(claims.iss)) return bad('wrong_issuer');
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.some((a) => typeof a === 'string' && settings.audiences.includes(a))) return bad('wrong_app');
  const seconds = Math.floor(now / 1000);
  if (typeof claims.exp !== 'number' || claims.exp < seconds) return bad('expired');
  // A little slack for clocks that disagree.
  if (typeof claims.iat === 'number' && claims.iat > seconds + 300) return bad('not_yet');
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255) return bad('no_subject');

  const email = typeof claims.email === 'string' ? claims.email : null;
  // Apple sends "true" as text in some tokens.
  const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
  return { ok: true, identity: { subject: claims.sub, email, emailVerified } };
}
