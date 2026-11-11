const { openDatabase } = require('../db');
const { readConfig } = require('../lib/config');
const { createApp } = require('../app');

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** Starts the real app on a random port against an in-memory Postgres. */
async function startServer(env = {}) {
  const config = readConfig({ NODE_ENV: 'test', ...env });
  const db = await openDatabase({ dataDir: 'memory://' });
  const app = createApp({ db, config, frontendDir: '/nonexistent' });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(path, { body, headers = {}, ...options } = {}) {
    const res = await fetch(`${base}${path}`, {
      redirect: 'manual',
      ...options,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const type = res.headers.get('content-type') || '';
    const data = type.includes('application/json') ? await res.json() : await res.text();
    return { status: res.status, headers: res.headers, data };
  }

  async function close() {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  }

  return { base, db, request, close };
}

module.exports = { IPHONE_UA, startServer };
