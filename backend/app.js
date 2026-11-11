const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { createAuth } = require('./lib/auth');
const createAuthRouter = require('./routes/auth');
const createQrRouter = require('./routes/qr');
const createRedirectRouter = require('./routes/redirect');

const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');

/**
 * Builds the Express app. One service serves the tracking redirects, the API and
 * the built dashboard, so everything is same-origin: no CORS, no tokens in the
 * browser bundle.
 */
function createApp({ db, config, frontendDir = FRONTEND_DIST }) {
  const app = express();
  const auth = createAuth(config);

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:', 'blob:'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
      },
    },
  }));

  app.get('/health', async (req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: db.kind });
  });

  // Scans past the limit still redirect; they just aren't counted.
  const scanLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: false,
    legacyHeaders: false,
    handler: (req, res, next) => {
      req.skipScanLogging = true;
      next();
    },
  });
  app.use('/r', scanLimiter, createRedirectRouter({ db, config }));

  const api = express.Router();
  api.use(express.json({ limit: '256kb' }));
  // Only JSON writes are accepted, which a cross-site form post can't produce.
  api.use((req, res, next) => {
    if (['POST', 'PATCH', 'PUT'].includes(req.method) && !req.is('application/json')) {
      return res.status(415).json({ error: 'Send JSON (Content-Type: application/json)' });
    }
    next();
  });
  api.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  }));
  api.use('/auth', createAuthRouter({ auth }));
  api.use('/qr', auth.requireAdmin, createQrRouter({ db, config }));
  api.use((req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use('/api', api);

  if (fs.existsSync(path.join(frontendDir, 'index.html'))) {
    app.use(express.static(frontendDir, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));
  } else {
    app.get('/', (req, res) => {
      res.type('text').send('QRTrack API is running. Build the dashboard with `npm run build`, or use `npm run dev`.');
    });
  }

  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error('[ERROR]', err);
    res.status(status).json({
      error: status < 500 || err.expose ? err.message : 'Something went wrong on our side',
    });
  });

  return app;
}

module.exports = { createApp };
