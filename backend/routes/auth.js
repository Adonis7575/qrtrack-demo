const express = require('express');
const rateLimit = require('express-rate-limit');

module.exports = function createAuthRouter({ auth }) {
  const router = express.Router();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Try again in a few minutes.' },
  });

  router.get('/me', (req, res) => {
    res.json({ authRequired: auth.enabled, authenticated: auth.isAuthenticated(req) });
  });

  router.post('/login', loginLimiter, (req, res) => {
    if (!auth.enabled) return res.json({ authenticated: true });
    if (!auth.checkPassword(req.body?.password)) {
      return res.status(401).json({ error: 'Wrong password' });
    }
    auth.setSession(res);
    res.json({ authenticated: true });
  });

  router.post('/logout', (req, res) => {
    auth.clearSession(res);
    res.json({ authenticated: false });
  });

  return router;
};
