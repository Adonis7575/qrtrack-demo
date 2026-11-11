const express = require('express');
const { generateId, renderPng, renderSvg } = require('../lib/qr');
const {
  clampInt,
  normalizeLabel,
  normalizeStyle,
  validateCode,
  validateDestination,
} = require('../lib/validation');

const MAX_BULK_ITEMS = 200;
const QR_COLUMNS = `id, destination_type, destination_url, text_content, label, style,
  total_scans, unique_scans, created_at, updated_at`;

function httpError(status, message) {
  return Object.assign(new Error(message), { status, expose: true });
}

module.exports = function createQrRouter({ db, config }) {
  const router = express.Router();

  const baseUrlFor = (req) => config.baseUrl || `${req.protocol}://${req.get('host')}`;
  const present = (req, row) => ({ ...row, tracking_url: `${baseUrlFor(req)}/r/${row.id}` });

  async function findQr(id) {
    const { rows } = await db.query(`SELECT ${QR_COLUMNS} FROM qr_codes WHERE id = $1`, [id]);
    if (!rows[0]) throw httpError(404, 'QR code not found');
    return rows[0];
  }

  /** Validates one create payload. Returns { value } or { error }. */
  function parseCreate(body) {
    const destination = validateDestination(body);
    if (destination.error) return destination;

    const code = validateCode(body.code);
    if (code.error) return code;

    return {
      value: {
        id: code.value,
        ...destination.value,
        label: normalizeLabel(body.label),
        style: normalizeStyle(body.style),
      },
    };
  }

  async function insertQr(item) {
    const custom = Boolean(item.id);

    // Random IDs retry on the (astronomically unlikely) collision; custom codes report it.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const id = item.id || generateId();
      try {
        const { rows } = await db.query(
          `INSERT INTO qr_codes (id, destination_type, destination_url, text_content, label, style)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING ${QR_COLUMNS}`,
          [id, item.destination_type, item.destination_url, item.text_content, item.label, JSON.stringify(item.style)]
        );
        return rows[0];
      } catch (err) {
        if (err.code !== '23505') throw err;
        if (custom) throw httpError(409, `The code "${id}" is already taken`);
      }
    }
    throw httpError(500, 'Could not allocate a QR code ID');
  }

  router.get('/', async (req, res) => {
    const { rows } = await db.query(`SELECT ${QR_COLUMNS} FROM qr_codes ORDER BY created_at DESC`);

    const totals = rows.reduce(
      (acc, qr) => ({
        qr_count: acc.qr_count + 1,
        total_scans: acc.total_scans + qr.total_scans,
        unique_scans: acc.unique_scans + qr.unique_scans,
      }),
      { qr_count: 0, total_scans: 0, unique_scans: 0 }
    );

    res.json({ qr_codes: rows.map((row) => present(req, row)), totals });
  });

  router.post('/', async (req, res) => {
    const { value, error } = parseCreate(req.body);
    if (error) return res.status(400).json({ error });

    const row = await insertQr(value);
    res.status(201).json(present(req, row));
  });

  /**
   * Body: { items: [{ destination, label?, code?, type? }], style? }
   * Creates every valid item; failures are reported per line instead of
   * aborting the batch.
   */
  router.post('/bulk', async (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: 'Add at least one item' });
    if (items.length > MAX_BULK_ITEMS) {
      return res.status(400).json({ error: `Bulk create is limited to ${MAX_BULK_ITEMS} items` });
    }

    const created = [];
    const errors = [];

    for (const [index, item] of items.entries()) {
      const { value, error } = parseCreate({ style: req.body.style, ...item });
      if (error) {
        errors.push({ index, error });
        continue;
      }
      try {
        created.push(present(req, await insertQr(value)));
      } catch (err) {
        if (!err.expose) throw err;
        errors.push({ index, error: err.message });
      }
    }

    res.status(created.length ? 201 : 400).json({ created, errors });
  });

  router.get('/:id', async (req, res) => {
    res.json(present(req, await findQr(req.params.id)));
  });

  /** Dynamic QR: the printed code stays the same, the destination can change. */
  router.patch('/:id', async (req, res) => {
    const current = await findQr(req.params.id);
    const body = req.body || {};
    const next = {
      destination_type: current.destination_type,
      destination_url: current.destination_url,
      text_content: current.text_content,
      label: current.label,
      style: current.style,
    };

    if (body.destination !== undefined) {
      const { value, error } = validateDestination(body);
      if (error) return res.status(400).json({ error });
      Object.assign(next, value);
    }
    if (body.label !== undefined) next.label = normalizeLabel(body.label);
    if (body.style !== undefined) next.style = normalizeStyle({ ...current.style, ...body.style });

    const { rows } = await db.query(
      `UPDATE qr_codes
       SET destination_type = $2, destination_url = $3, text_content = $4,
           label = $5, style = $6, updated_at = NOW()
       WHERE id = $1
       RETURNING ${QR_COLUMNS}`,
      [current.id, next.destination_type, next.destination_url, next.text_content, next.label, JSON.stringify(next.style)]
    );

    res.json(present(req, rows[0]));
  });

  router.delete('/:id', async (req, res) => {
    const { rows } = await db.query('DELETE FROM qr_codes WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) throw httpError(404, 'QR code not found');
    res.json({ success: true });
  });

  router.get('/:id/timeline', async (req, res) => {
    await findQr(req.params.id);
    const days = clampInt(req.query.days, 30, 1, 365);

    const { rows } = await db.query(
      `WITH bounds AS (
         SELECT (NOW() AT TIME ZONE 'UTC')::date AS today, $2::int AS days
       ),
       recent AS (
         SELECT (scanned_at AT TIME ZONE 'UTC')::date AS day, is_unique
         FROM scans, bounds
         WHERE qr_id = $1
           AND scanned_at >= ((bounds.today - (bounds.days - 1)) AT TIME ZONE 'UTC')
       )
       SELECT series.day::date::text AS date,
              COUNT(recent.day)::int AS total,
              COUNT(recent.day) FILTER (WHERE recent.is_unique)::int AS unique_count
       FROM bounds,
            generate_series(bounds.today - (bounds.days - 1), bounds.today, INTERVAL '1 day') AS series(day)
       LEFT JOIN recent ON recent.day = series.day::date
       GROUP BY series.day
       ORDER BY series.day`,
      [req.params.id, days]
    );

    res.json(rows);
  });

  router.get('/:id/scans', async (req, res) => {
    await findQr(req.params.id);
    const limit = clampInt(req.query.limit, 50, 1, 500);

    const { rows } = await db.query(
      `SELECT id::text, scanned_at, is_unique, device, browser, os
       FROM scans WHERE qr_id = $1
       ORDER BY scanned_at DESC
       LIMIT $2`,
      [req.params.id, limit]
    );

    res.json(rows);
  });

  router.get('/:id/breakdown', async (req, res) => {
    await findQr(req.params.id);

    const { rows } = await db.query(
      `SELECT 'device' AS dimension, COALESCE(device, 'Unknown') AS name, COUNT(*)::int AS count
         FROM scans WHERE qr_id = $1 GROUP BY 2
       UNION ALL
       SELECT 'browser', COALESCE(browser, 'Unknown'), COUNT(*)::int
         FROM scans WHERE qr_id = $1 GROUP BY 2
       UNION ALL
       SELECT 'os', COALESCE(os, 'Unknown'), COUNT(*)::int
         FROM scans WHERE qr_id = $1 GROUP BY 2
       ORDER BY 1, 3 DESC`,
      [req.params.id]
    );

    const breakdown = { device: [], browser: [], os: [] };
    for (const row of rows) breakdown[row.dimension].push({ name: row.name, count: row.count });
    res.json(breakdown);
  });

  /** GET /api/qr/:id/image?format=png|svg&size=1024 — handy for scripts and direct links. */
  router.get('/:id/image', async (req, res) => {
    const qr = present(req, await findQr(req.params.id));
    const style = normalizeStyle(qr.style);
    const size = clampInt(req.query.size, 1024, 128, 4096);
    const filename = `qr-${qr.id}`;

    if (req.query.format === 'svg') {
      res.type('image/svg+xml');
      res.attachment(`${filename}.svg`);
      return res.send(await renderSvg(qr.tracking_url, style, size));
    }

    res.type('png');
    res.attachment(`${filename}.png`);
    res.send(await renderPng(qr.tracking_url, style, size));
  });

  return router;
};
