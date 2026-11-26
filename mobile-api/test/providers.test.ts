import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handle, type Env } from '../src/handle.ts';
import { openLocalDb } from '../src/local-db.ts';
import type { Jwk } from '../src/providers.ts';

const NOW = 1_800_000_000_000;
const b64url = (data: Uint8Array | string) =>
  Buffer.from(data as never).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function makeSigner(kid: string) {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const pub = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as { n: string; e: string };
  const jwk: Jwk = { kid, kty: 'RSA', n: pub.n, e: pub.e };
  const sign = async (claims: object, header: object = { alg: 'RS256', kid }) => {
    const head = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(head));
    return `${head}.${b64url(new Uint8Array(sig))}`;
  };
  return { jwk, sign };
}

const apple = await makeSigner('apple-key-1');
const google = await makeSigner('google-key-1');
const stranger = await makeSigner('apple-key-1'); // same key id, different key

const env = (extra: Partial<Env> = {}): Env => ({
  DB: openLocalDb(),
  DEV_SHOW_CODE: '1',
  APPLE_AUDIENCE: 'com.flexdaddies.app',
  GOOGLE_AUDIENCES: 'ios-client.apps.googleusercontent.com, android-client.apps.googleusercontent.com',
  fetchProviderKeys: async (url) => (url.includes('apple') ? [apple.jwk] : [google.jwk]),
  ...extra,
});

const appleClaims = (over: object = {}) => ({
  iss: 'https://appleid.apple.com',
  aud: 'com.flexdaddies.app',
  sub: 'apple-user-001',
  email: 'Sam@Example.com',
  email_verified: 'true',
  iat: NOW / 1000 - 10,
  exp: NOW / 1000 + 600,
  ...over,
});
const googleClaims = (over: object = {}) => ({
  iss: 'https://accounts.google.com',
  aud: 'ios-client.apps.googleusercontent.com',
  sub: 'google-user-001',
  email: 'sam@example.com',
  email_verified: true,
  iat: NOW / 1000 - 10,
  exp: NOW / 1000 + 600,
  ...over,
});

async function post(e: Env, path: string, body: unknown, now = NOW) {
  const res = await handle(
    new Request(`http://test${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    e,
    now,
  );
  return { status: res.status, data: (await res.json()) as Record<string, any> };
}

test('Sign in with Apple makes an account the first time and finds it after', async () => {
  const e = env();
  const first = await post(e, '/auth/apple', { identityToken: await apple.sign(appleClaims()), name: ' Sam ' });
  assert.equal(first.status, 200);
  assert.deepEqual([first.data.isNew, first.data.user.email, first.data.user.name], [true, 'sam@example.com', 'Sam']);
  // Apple leaves the email out of later tokens: the account is found by Apple's own id for the person.
  const later = await post(e, '/auth/apple', { identityToken: await apple.sign(appleClaims({ email: undefined, email_verified: undefined })) });
  assert.deepEqual([later.data.isNew, later.data.user.id], [false, first.data.user.id]);
  assert.notEqual(later.data.token, first.data.token);
});

test('Apple, Google and the emailed code all reach the same account for one email', async () => {
  const e = env();
  const start = await post(e, '/auth/email/start', { email: 'sam@example.com' });
  const byCode = await post(e, '/auth/email/verify', { email: 'sam@example.com', code: start.data.devCode });
  const byApple = await post(e, '/auth/apple', { identityToken: await apple.sign(appleClaims()) });
  const byGoogle = await post(e, '/auth/google', { identityToken: await google.sign(googleClaims()) });
  assert.equal(byApple.data.user.id, byCode.data.user.id);
  assert.equal(byGoogle.data.user.id, byCode.data.user.id);
  assert.equal(byApple.data.isNew, false);
  const count = await e.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
  assert.equal(count?.n, 1);
});

test('a token is refused unless it is genuine, for this app, and still valid', async () => {
  const e = env();
  const refused = async (token: string, path = '/auth/apple') => {
    const r = await post(e, path, { identityToken: token });
    assert.equal(r.data.error, 'sign_in_failed', JSON.stringify(r.data));
    assert.equal(r.status, 401);
  };
  await refused(await stranger.sign(appleClaims())); // signed by someone else
  await refused(await apple.sign(appleClaims({ aud: 'com.someone.else' }))); // meant for another app
  await refused(await apple.sign(appleClaims({ iss: 'https://evil.example' })));
  await refused(await apple.sign(appleClaims({ exp: NOW / 1000 - 5 })));
  await refused(await apple.sign(appleClaims(), { alg: 'RS256', kid: 'unknown-key' }));
  await refused(await apple.sign(appleClaims(), { alg: 'none', kid: 'apple-key-1' }));
  await refused(await apple.sign(appleClaims()), '/auth/google'); // Apple token at the Google door
  const real = await apple.sign(appleClaims());
  await refused(real.slice(0, -4) + 'AAAA'); // tampered
  await refused('not-a-token');
  const users = await e.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
  assert.equal(users?.n, 0);
});

test('an unconfirmed email never joins an existing account', async () => {
  const e = env();
  const start = await post(e, '/auth/email/start', { email: 'sam@example.com' });
  await post(e, '/auth/email/verify', { email: 'sam@example.com', code: start.data.devCode });
  const r = await post(e, '/auth/google', { identityToken: await google.sign(googleClaims({ email_verified: false })) });
  assert.equal(r.data.error, 'no_email');
  const none = await post(e, '/auth/apple', { identityToken: await apple.sign(appleClaims({ sub: 'new-person', email: undefined })) });
  assert.equal(none.data.error, 'no_email');
});

test('both say so plainly until they are set up', async () => {
  const off = env({ APPLE_AUDIENCE: undefined, GOOGLE_AUDIENCES: '' });
  assert.equal((await post(off, '/auth/apple', { identityToken: 'x' })).data.error, 'not_set_up');
  assert.equal((await post(off, '/auth/google', { identityToken: 'x' })).data.error, 'not_set_up');
});

test("when the provider's keys cannot be fetched, sign-in asks to try again", async () => {
  const e = env({ fetchProviderKeys: async () => { throw new Error('down'); } });
  const r = await post(e, '/auth/apple', { identityToken: await apple.sign(appleClaims()) });
  assert.equal(r.status, 503);
});

test('delete my account forgets the Apple and Google identities too', async () => {
  const e = env();
  const first = await post(e, '/auth/apple', { identityToken: await apple.sign(appleClaims()) });
  await handle(new Request('http://test/me', { method: 'DELETE', headers: { authorization: `Bearer ${first.data.token}` } }), e, NOW);
  const left = await e.DB.prepare('SELECT COUNT(*) AS n FROM identities').first<{ n: number }>();
  assert.equal(left?.n, 0);
  const again = await post(e, '/auth/apple', { identityToken: await apple.sign(appleClaims()) });
  assert.equal(again.data.isNew, true);
});
