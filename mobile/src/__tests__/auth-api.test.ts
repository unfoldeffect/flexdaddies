import { NOT_SET_UP_MESSAGE, OFFLINE_MESSAGE, isEmail, isSession, makeAuthApi, tidyCode } from '../lib/auth-api';

const reply = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('sign-in helpers', () => {
  it('checks email addresses', () => {
    expect(isEmail(' sam@example.com ')).toBe(true);
    expect(isEmail('sam@example')).toBe(false);
    expect(isEmail('')).toBe(false);
  });

  it('keeps six digits of a typed or pasted code', () => {
    expect(tidyCode('4 8 2-1 0 7')).toBe('482107');
    expect(tidyCode('1234567890')).toBe('123456');
  });

  it('only accepts a complete saved session', () => {
    const account = { id: 'u1', email: 'sam@example.com', name: 'Sam', weightUnit: 'lbs' };
    expect(isSession({ token: 't', account })).toBe(true);
    expect(isSession({ token: '', account })).toBe(false);
    expect(isSession({ token: 't' })).toBe(false);
    expect(isSession(null)).toBe(false);
  });
});

describe('accounts server client', () => {
  it('sends the code request and the sign-in to the right places', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const api = makeAuthApi('https://api.test', async (url, init) => {
      calls.push({ url, init });
      return reply(200, { ok: true });
    });
    await api.start('sam@example.com');
    await api.me('tok');
    expect(calls[0].url).toBe('https://api.test/auth/email/start');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ email: 'sam@example.com' });
    expect((calls[1].init.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it("passes on the server's own message when it says no", async () => {
    const api = makeAuthApi('https://api.test', async () =>
      reply(429, { error: 'too_soon', message: 'Wait a moment.', retryAfterSeconds: 12 }),
    );
    expect(await api.start('sam@example.com')).toEqual({
      ok: false,
      error: 'too_soon',
      message: 'Wait a moment.',
      retryAfterSeconds: 12,
    });
  });

  it('says so plainly when there is no connection', async () => {
    const api = makeAuthApi('https://api.test', async () => {
      throw new Error('network down');
    });
    expect(await api.verify('sam@example.com', '123456')).toEqual({
      ok: false,
      error: 'offline',
      message: OFFLINE_MESSAGE,
    });
  });

  it('does not try the network when no server is set', async () => {
    const fetcher = jest.fn();
    const r = await makeAuthApi(null, fetcher).start('sam@example.com');
    expect(r).toEqual({ ok: false, error: 'not_set_up', message: NOT_SET_UP_MESSAGE });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
