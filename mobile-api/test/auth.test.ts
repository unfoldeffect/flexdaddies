import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handle, normalizeEmail, newCode, type Env } from '../src/handle.ts';
import { openLocalDb } from '../src/local-db.ts';

const MIN = 60_000;
const freshEnv = (extra: Partial<Env> = {}): Env => ({ DB: openLocalDb(), DEV_SHOW_CODE: '1', ...extra });

async function call(env: Env, method: string, path: string, body?: unknown, token?: string, now = 1_000_000) {
  const res = await handle(
    new Request(`http://test${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
    now,
  );
  return { status: res.status, data: (await res.json()) as Record<string, any> };
}

async function signIn(env: Env, email = 'sam@example.com', now = 1_000_000) {
  const start = await call(env, 'POST', '/auth/email/start', { email }, undefined, now);
  const done = await call(env, 'POST', '/auth/email/verify', { email, code: start.data.devCode }, undefined, now);
  return done.data as { token: string; user: Record<string, string>; isNew: boolean };
}

test('email addresses are tidied and checked', () => {
  assert.equal(normalizeEmail('  Sam@Example.COM '), 'sam@example.com');
  assert.equal(normalizeEmail('not an email'), null);
  assert.equal(normalizeEmail(42), null);
});

test('codes are always six digits', () => {
  for (let i = 0; i < 200; i++) assert.match(newCode(), /^\d{6}$/);
});

test('a new person signs in with the emailed code and gets an account', async () => {
  const env = freshEnv();
  const first = await signIn(env, ' Sam@Example.com ');
  assert.equal(first.isNew, true);
  assert.equal(first.user.email, 'sam@example.com');
  assert.equal(first.user.name, '');
  const me = await call(env, 'GET', '/me', undefined, first.token);
  assert.equal(me.status, 200);
  assert.equal(me.data.user.id, first.user.id);
});

test('signing in again finds the same account', async () => {
  const env = freshEnv();
  const a = await signIn(env);
  const b = await signIn(env, 'sam@example.com', 1_000_000 + MIN);
  assert.equal(b.isNew, false);
  assert.equal(b.user.id, a.user.id);
  assert.notEqual(b.token, a.token);
});

test('a wrong code is refused, and five wrong tries use the code up', async () => {
  const env = freshEnv();
  const email = 'sam@example.com';
  const start = await call(env, 'POST', '/auth/email/start', { email });
  const wrong = start.data.devCode === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) {
    const r = await call(env, 'POST', '/auth/email/verify', { email, code: wrong });
    assert.equal(r.data.error, 'wrong_code');
  }
  const late = await call(env, 'POST', '/auth/email/verify', { email, code: start.data.devCode });
  assert.equal(late.data.error, 'expired_code');
});

test('a code stops working after 10 minutes and works only once', async () => {
  const env = freshEnv();
  const email = 'sam@example.com';
  const start = await call(env, 'POST', '/auth/email/start', { email });
  const late = await call(env, 'POST', '/auth/email/verify', { email, code: start.data.devCode }, undefined, 1_000_000 + 11 * MIN);
  assert.equal(late.data.error, 'expired_code');

  const again = await call(env, 'POST', '/auth/email/start', { email }, undefined, 1_000_000 + 12 * MIN);
  const ok = await call(env, 'POST', '/auth/email/verify', { email, code: again.data.devCode }, undefined, 1_000_000 + 12 * MIN);
  assert.equal(ok.status, 200);
  const reuse = await call(env, 'POST', '/auth/email/verify', { email, code: again.data.devCode }, undefined, 1_000_000 + 12 * MIN);
  assert.equal(reuse.data.error, 'wrong_code');
});

test('codes cannot be requested too fast or too often', async () => {
  const env = freshEnv();
  const email = 'sam@example.com';
  let now = 1_000_000;
  assert.equal((await call(env, 'POST', '/auth/email/start', { email }, undefined, now)).status, 200);
  const soon = await call(env, 'POST', '/auth/email/start', { email }, undefined, now + 5_000);
  assert.equal(soon.data.error, 'too_soon');
  for (let i = 0; i < 4; i++) {
    now += MIN;
    assert.equal((await call(env, 'POST', '/auth/email/start', { email }, undefined, now)).status, 200);
  }
  now += MIN;
  assert.equal((await call(env, 'POST', '/auth/email/start', { email }, undefined, now)).data.error, 'too_many');
  now += 61 * MIN;
  assert.equal((await call(env, 'POST', '/auth/email/start', { email }, undefined, now)).status, 200);
});

test('bad email is refused', async () => {
  const r = await call(freshEnv(), 'POST', '/auth/email/start', { email: 'nope' });
  assert.equal(r.status, 400);
});

test('without an email service the code is never handed back', async () => {
  const off = await call({ DB: openLocalDb() }, 'POST', '/auth/email/start', { email: 'sam@example.com' });
  assert.equal(off.data.error, 'email_not_set_up');

  const sent: string[] = [];
  const env: Env = { DB: openLocalDb(), sendCode: async (_to, code) => (sent.push(code), true) };
  const on = await call(env, 'POST', '/auth/email/start', { email: 'sam@example.com' });
  assert.equal(on.status, 200);
  assert.equal(on.data.devCode, undefined);
  const done = await call(env, 'POST', '/auth/email/verify', { email: 'sam@example.com', code: sent[0] });
  assert.equal(done.status, 200);
});

test('name and units are saved, and bad ones refused', async () => {
  const env = freshEnv();
  const { token } = await signIn(env);
  const saved = await call(env, 'PATCH', '/me', { name: '  Sam  ', weightUnit: 'kg' }, token);
  assert.deepEqual([saved.data.user.name, saved.data.user.weightUnit], ['Sam', 'kg']);
  assert.equal((await call(env, 'PATCH', '/me', { name: '   ' }, token)).status, 400);
  assert.equal((await call(env, 'PATCH', '/me', { weightUnit: 'stone' }, token)).status, 400);
  assert.equal((await call(env, 'GET', '/me', undefined, token)).data.user.name, 'Sam');
});

test('nothing works without signing in', async () => {
  const env = freshEnv();
  assert.equal((await call(env, 'GET', '/me')).status, 401);
  assert.equal((await call(env, 'GET', '/me', undefined, 'made-up-token')).status, 401);
  assert.equal((await call(env, 'DELETE', '/me', undefined, 'made-up-token')).status, 401);
});

test('sign out ends that phone only', async () => {
  const env = freshEnv();
  const a = await signIn(env);
  const b = await signIn(env, 'sam@example.com', 1_000_000 + MIN);
  assert.equal((await call(env, 'POST', '/auth/signout', undefined, a.token)).status, 200);
  assert.equal((await call(env, 'GET', '/me', undefined, a.token)).status, 401);
  assert.equal((await call(env, 'GET', '/me', undefined, b.token)).status, 200);
});

test('delete my account removes the account and every signed-in phone, and nobody else', async () => {
  const env = freshEnv();
  const a = await signIn(env);
  const a2 = await signIn(env, 'sam@example.com', 1_000_000 + MIN);
  const other = await signIn(env, 'kim@example.com');
  assert.equal((await call(env, 'DELETE', '/me', undefined, a.token)).data.deleted, true);
  assert.equal((await call(env, 'GET', '/me', undefined, a.token)).status, 401);
  assert.equal((await call(env, 'GET', '/me', undefined, a2.token)).status, 401);
  assert.equal((await call(env, 'GET', '/me', undefined, other.token)).status, 200);
  const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
  assert.equal(left?.n, 1);
  // The same email can start fresh afterwards.
  const back = await signIn(env, 'sam@example.com', 1_000_000 + 5 * MIN);
  assert.equal(back.isNew, true);
  assert.notEqual(back.user.id, a.user.id);
});

test('only hashes of codes and tokens are stored', async () => {
  const env = freshEnv();
  const start = await call(env, 'POST', '/auth/email/start', { email: 'sam@example.com' });
  const row = await env.DB.prepare('SELECT code_hash FROM login_codes').first<{ code_hash: string }>();
  assert.notEqual(row?.code_hash, start.data.devCode);
  assert.equal(row?.code_hash.length, 64);
  const done = await call(env, 'POST', '/auth/email/verify', { email: 'sam@example.com', code: start.data.devCode });
  const s = await env.DB.prepare('SELECT token_hash FROM sessions').first<{ token_hash: string }>();
  assert.notEqual(s?.token_hash, done.data.token);
});

test('a phone saves its data to the account and a new phone gets it back', async () => {
  const env = freshEnv();
  const phone = await signIn(env);
  assert.deepEqual((await call(env, 'GET', '/data', undefined, phone.token)).data, { rev: 0, data: null });
  const data = { workouts: [{ id: 'w1', user: 'me', note: 'café ☕' }], templates: [] };
  const saved = await call(env, 'PUT', '/data', { baseRev: 0, data }, phone.token);
  assert.deepEqual([saved.status, saved.data.rev], [200, 1]);
  const newPhone = await signIn(env, 'sam@example.com', 1_000_000 + MIN);
  assert.deepEqual((await call(env, 'GET', '/data', undefined, newPhone.token)).data, { rev: 1, data });
});

test('a save on top of an old copy is refused and handed the newer copy', async () => {
  const env = freshEnv();
  const a = await signIn(env);
  const b = await signIn(env, 'sam@example.com', 1_000_000 + MIN);
  await call(env, 'PUT', '/data', { baseRev: 0, data: { workouts: [1] } }, a.token);
  const late = await call(env, 'PUT', '/data', { baseRev: 0, data: { workouts: [2] } }, b.token);
  assert.equal(late.status, 409);
  assert.deepEqual([late.data.rev, late.data.data], [1, { workouts: [1] }]);
  const merged = await call(env, 'PUT', '/data', { baseRev: 1, data: { workouts: [1, 2] } }, b.token);
  assert.deepEqual([merged.status, merged.data.rev], [200, 2]);
});

test('saved data is private to its account, needs signing in, and must be an object', async () => {
  const env = freshEnv();
  const sam = await signIn(env);
  const kim = await signIn(env, 'kim@example.com');
  await call(env, 'PUT', '/data', { baseRev: 0, data: { workouts: ['sam'] } }, sam.token);
  assert.deepEqual((await call(env, 'GET', '/data', undefined, kim.token)).data, { rev: 0, data: null });
  assert.equal((await call(env, 'GET', '/data')).status, 401);
  assert.equal((await call(env, 'PUT', '/data', { baseRev: 0, data: [1] }, sam.token)).status, 400);
  assert.equal((await call(env, 'PUT', '/data', { data: {} }, sam.token)).status, 400);
});

test('the saved copy is squeezed, and a big one still comes back whole', async () => {
  const env = freshEnv();
  const { token } = await signIn(env);
  const workouts = Array.from({ length: 3000 }, (_, i) => ({ id: `w${i}`, user: 'me', exercises: [{ name: 'Bench Press', sets: [{ reps: 8, weight: 135 }] }] }));
  assert.equal((await call(env, 'PUT', '/data', { baseRev: 0, data: { workouts } }, token)).status, 200);
  const row = await env.DB.prepare('SELECT length(data_gz) AS stored, bytes FROM user_data').first<{ stored: number; bytes: number }>();
  assert.ok(row!.stored < row!.bytes / 5, `stored ${row!.stored} of ${row!.bytes}`);
  const back = await call(env, 'GET', '/data', undefined, token);
  assert.equal(back.data.data.workouts.length, 3000);
});

test('delete my account removes the saved data too', async () => {
  const env = freshEnv();
  const { token } = await signIn(env);
  await call(env, 'PUT', '/data', { baseRev: 0, data: { workouts: [1] } }, token);
  await call(env, 'DELETE', '/me', undefined, token);
  const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM user_data').first<{ n: number }>();
  assert.equal(left?.n, 0);
  const again = await signIn(env, 'sam@example.com', 1_000_000 + 5 * MIN);
  assert.deepEqual((await call(env, 'GET', '/data', undefined, again.token)).data, { rev: 0, data: null });
});
