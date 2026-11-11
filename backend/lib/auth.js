const crypto = require('node:crypto');

const COOKIE_NAME = 'qrtrack_session';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * Single-admin auth. Sessions are stateless signed cookies:
 *   <expiresAt>.<hmac(expiresAt)>
 * The HMAC key mixes in the password, so changing ADMIN_PASSWORD logs everyone out.
 */
function createAuth(config) {
  const enabled = Boolean(config.adminPassword);
  const key = crypto
    .createHash('sha256')
    .update(`${config.appSecret}:${config.adminPassword}`)
    .digest();

  const sign = (value) => crypto.createHmac('sha256', key).update(value).digest('base64url');

  function isAuthenticated(req) {
    if (!enabled) return true;

    const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (bearer && safeEqual(bearer, config.adminPassword)) return true;

    const cookie = readCookie(req, COOKIE_NAME);
    if (!cookie) return false;

    const [expiresAt, signature] = cookie.split('.');
    if (!expiresAt || !signature || !safeEqual(signature, sign(expiresAt))) return false;
    return Number(expiresAt) > Date.now();
  }

  function setSession(res) {
    const expiresAt = String(Date.now() + SESSION_MS);
    res.cookie(COOKIE_NAME, `${expiresAt}.${sign(expiresAt)}`, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
      maxAge: SESSION_MS,
      path: '/',
    });
  }

  function clearSession(res) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
  }

  function requireAdmin(req, res, next) {
    if (isAuthenticated(req)) return next();
    return res.status(401).json({ error: 'Sign in required' });
  }

  return {
    enabled,
    isAuthenticated,
    checkPassword: (password) => enabled && safeEqual(password || '', config.adminPassword),
    setSession,
    clearSession,
    requireAdmin,
  };
}

module.exports = { createAuth };
