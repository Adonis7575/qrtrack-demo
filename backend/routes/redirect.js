const express = require('express');
const { buildFingerprint, describeDevice, isBot } = require('../lib/visitor');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; }
    main { max-width: 720px; margin: 0 auto; padding: 48px 20px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 20px; background: #fff; border: 1px solid #dbe3ef; border-radius: 8px; line-height: 1.55; font: inherit; }
  </style>
</head>
<body><main>${body}</main></body>
</html>`;
}

module.exports = function createRedirectRouter({ db, config }) {
  const router = express.Router();

  async function recordScan(req, id) {
    const userAgent = (req.get('user-agent') || '').slice(0, 512);
    if (req.method !== 'GET' || req.skipScanLogging || isBot(userAgent)) return;

    const { device, browser, os } = describeDevice(userAgent);
    await db.query('SELECT record_qr_scan($1, $2, $3, $4, $5)', [
      id,
      buildFingerprint(req.ip, userAgent, config.appSecret),
      device,
      browser,
      os,
    ]);
  }

  router.get('/:id', async (req, res) => {
    const { rows } = await db.query(
      'SELECT id, destination_type, destination_url, text_content, label FROM qr_codes WHERE id = $1',
      [req.params.id]
    );
    const qr = rows[0];

    res.set('Cache-Control', 'no-store');

    if (!qr) {
      return res.status(404).type('html').send(page(
        'QR code not found',
        '<h1>QR code not found</h1><p>This QR code may have been deleted or never existed.</p>'
      ));
    }

    // A failed scan log must never block the visitor.
    try {
      await recordScan(req, qr.id);
    } catch (err) {
      console.error('[SCAN LOG ERROR]', err.message);
    }

    if (qr.destination_type === 'text') {
      const title = qr.label || 'Message';
      return res.type('html').send(page(
        title,
        `<h1>${escapeHtml(title)}</h1><pre>${escapeHtml(qr.text_content)}</pre>`
      ));
    }

    return res.redirect(302, qr.destination_url);
  });

  return router;
};
