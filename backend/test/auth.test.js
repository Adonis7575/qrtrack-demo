const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');
const { readConfig } = require('../lib/config');
const { startServer } = require('./helpers');

describe('sign-in', () => {
  let srv;
  before(async () => { srv = await startServer({ ADMIN_PASSWORD: 'correct horse' }); });
  after(() => srv.close());

  test('API is locked without a session', async () => {
    assert.equal((await srv.request('/api/qr')).status, 401);
    assert.deepEqual((await srv.request('/api/auth/me')).data, { authRequired: true, authenticated: false });
  });

  test('wrong password is rejected', async () => {
    const { status } = await srv.request('/api/auth/login', { method: 'POST', body: { password: 'nope' } });
    assert.equal(status, 401);
  });

  test('login sets a working session cookie; logout clears it', async () => {
    const login = await srv.request('/api/auth/login', { method: 'POST', body: { password: 'correct horse' } });
    assert.equal(login.status, 200);

    const setCookie = login.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    const cookie = setCookie.split(';')[0];

    assert.equal((await srv.request('/api/qr', { headers: { cookie } })).status, 200);
    assert.equal((await srv.request('/api/qr', { headers: { cookie: `${cookie}x` } })).status, 401);

    const logout = await srv.request('/api/auth/logout', { method: 'POST', body: {}, headers: { cookie } });
    assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  });

  test('the password works as a bearer token for scripts', async () => {
    const { status } = await srv.request('/api/qr', {
      method: 'POST',
      headers: { Authorization: 'Bearer correct horse' },
      body: { destination: 'https://script.example' },
    });
    assert.equal(status, 201);
  });

  test('scan redirects stay public', async () => {
    const { data: qr } = await srv.request('/api/qr', {
      method: 'POST',
      headers: { Authorization: 'Bearer correct horse' },
      body: { destination: 'https://public.example' },
    });
    assert.equal((await srv.request(`/r/${qr.id}`)).status, 302);
  });
});

test('production refuses to start without its secrets', () => {
  assert.throws(
    () => readConfig({ NODE_ENV: 'production' }),
    /DATABASE_URL, ADMIN_PASSWORD, APP_SECRET/
  );
});
