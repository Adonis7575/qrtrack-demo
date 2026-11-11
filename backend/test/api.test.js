const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');
const { IPHONE_UA, startServer } = require('./helpers');

describe('QR API and tracking', () => {
  let srv;
  before(async () => { srv = await startServer(); });
  after(() => srv.close());

  test('creates a QR from a bare domain', async () => {
    const { status, data } = await srv.request('/api/qr', {
      method: 'POST',
      body: { destination: 'example.com/launch', label: 'Launch' },
    });

    assert.equal(status, 201);
    assert.equal(data.destination_type, 'url');
    assert.equal(data.destination_url, 'https://example.com/launch');
    assert.equal(data.label, 'Launch');
    assert.match(data.id, /^[A-Za-z0-9]{8}$/);
    assert.equal(data.tracking_url, `${srv.base}/r/${data.id}`);
    assert.deepEqual(data.style, { fg: '#0f172a', bg: '#ffffff', margin: 2, ecc: 'M' });
  });

  test('custom codes work once, then conflict', async () => {
    const first = await srv.request('/api/qr', { method: 'POST', body: { destination: 'https://a.io', code: 'menu' } });
    assert.equal(first.status, 201);
    assert.equal(first.data.id, 'menu');

    const again = await srv.request('/api/qr', { method: 'POST', body: { destination: 'https://b.io', code: 'menu' } });
    assert.equal(again.status, 409);
    assert.match(again.data.error, /already taken/);
  });

  test('rejects invalid input with a readable error', async () => {
    const { status, data } = await srv.request('/api/qr', { method: 'POST', body: { type: 'url', destination: 'javascript:alert(1)' } });
    assert.equal(status, 400);
    assert.equal(data.error, 'URL must use http, https, mailto, or tel');
  });

  test('rejects non-JSON writes', async () => {
    const res = await fetch(`${srv.base}/api/qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'destination=https://evil.example',
    });
    assert.equal(res.status, 415);
  });

  test('scan redirects, counts unique visitors, and ignores bots', async () => {
    const { data: qr } = await srv.request('/api/qr', { method: 'POST', body: { destination: 'https://example.com/scan' } });

    const first = await srv.request(`/r/${qr.id}`, { headers: { 'User-Agent': IPHONE_UA } });
    assert.equal(first.status, 302);
    assert.equal(first.headers.get('location'), 'https://example.com/scan');

    await srv.request(`/r/${qr.id}`, { headers: { 'User-Agent': IPHONE_UA } });
    await srv.request(`/r/${qr.id}`, { headers: { 'User-Agent': 'Slackbot-LinkExpanding 1.0' } });
    await srv.request(`/r/${qr.id}`, { method: 'HEAD', headers: { 'User-Agent': IPHONE_UA } });

    const { data: detail } = await srv.request(`/api/qr/${qr.id}`);
    assert.equal(detail.total_scans, 2);
    assert.equal(detail.unique_scans, 1);

    const { data: timeline } = await srv.request(`/api/qr/${qr.id}/timeline?days=7`);
    assert.equal(timeline.length, 7);
    assert.deepEqual(timeline.at(-1), {
      date: new Date().toISOString().slice(0, 10),
      total: 2,
      unique_count: 1,
    });

    const { data: scans } = await srv.request(`/api/qr/${qr.id}/scans`);
    assert.equal(scans.length, 2);
    assert.deepEqual(
      scans.map((s) => s.is_unique).sort(),
      [false, true]
    );
    assert.equal(scans[0].device, 'mobile');
    assert.equal(scans[0].os, 'iOS');

    const { data: breakdown } = await srv.request(`/api/qr/${qr.id}/breakdown`);
    assert.deepEqual(breakdown.device, [{ name: 'mobile', count: 2 }]);
  });

  test('text QR codes show an escaped page', async () => {
    const { data: qr } = await srv.request('/api/qr', {
      method: 'POST',
      body: { destination: '<script>alert(1)</script> hi', label: 'Note' },
    });
    assert.equal(qr.destination_type, 'text');

    const { status, data } = await srv.request(`/r/${qr.id}`, { headers: { 'User-Agent': IPHONE_UA } });
    assert.equal(status, 200);
    assert.ok(data.includes('&lt;script&gt;'));
    assert.ok(!data.includes('<script>alert'));
  });

  test('unknown codes 404 on both the redirect and the API', async () => {
    assert.equal((await srv.request('/r/nope1234')).status, 404);
    assert.equal((await srv.request('/api/qr/nope1234')).status, 404);
  });

  test('editing the destination keeps the same code', async () => {
    const { data: qr } = await srv.request('/api/qr', { method: 'POST', body: { destination: 'https://old.example' } });

    const { status, data } = await srv.request(`/api/qr/${qr.id}`, {
      method: 'PATCH',
      body: { destination: 'new.example', label: 'Renamed', style: { fg: '#112233' } },
    });
    assert.equal(status, 200);
    assert.equal(data.id, qr.id);
    assert.equal(data.destination_url, 'https://new.example/');
    assert.equal(data.label, 'Renamed');
    assert.equal(data.style.fg, '#112233');
    assert.equal(data.style.bg, '#ffffff');

    const scan = await srv.request(`/r/${qr.id}`, { headers: { 'User-Agent': IPHONE_UA } });
    assert.equal(scan.headers.get('location'), 'https://new.example/');
  });

  test('bulk create reports per-item errors', async () => {
    const { status, data } = await srv.request('/api/qr/bulk', {
      method: 'POST',
      body: {
        style: { fg: '#000000' },
        items: [
          { destination: 'one.example', label: 'One' },
          { destination: 'ftp://bad.example' },
          { destination: 'https://two.example', code: 'bulk-two' },
        ],
      },
    });

    assert.equal(status, 201);
    assert.equal(data.created.length, 2);
    assert.equal(data.created[0].style.fg, '#000000');
    assert.deepEqual(data.errors, [{ index: 1, error: 'URL must use http, https, mailto, or tel' }]);
  });

  test('serves PNG and SVG images', async () => {
    const { data: qr } = await srv.request('/api/qr', { method: 'POST', body: { destination: 'https://img.example' } });

    const png = await fetch(`${srv.base}/api/qr/${qr.id}/image?size=256`);
    assert.equal(png.headers.get('content-type'), 'image/png');
    const bytes = new Uint8Array(await png.arrayBuffer());
    assert.deepEqual([...bytes.slice(1, 4)], [0x50, 0x4e, 0x47]);

    const svg = await fetch(`${srv.base}/api/qr/${qr.id}/image?format=svg`);
    assert.match(svg.headers.get('content-type'), /image\/svg\+xml/);
    assert.match(await svg.text(), /^<svg/);
  });

  test('list returns totals; delete removes the code and its scans', async () => {
    const { data: qr } = await srv.request('/api/qr', { method: 'POST', body: { destination: 'https://bye.example' } });
    await srv.request(`/r/${qr.id}`, { headers: { 'User-Agent': IPHONE_UA } });

    const before = await srv.request('/api/qr');
    assert.ok(before.data.qr_codes.some((q) => q.id === qr.id));
    assert.equal(before.data.totals.qr_count, before.data.qr_codes.length);

    assert.equal((await srv.request(`/api/qr/${qr.id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await srv.request(`/api/qr/${qr.id}`)).status, 404);

    const { rows } = await srv.db.query('SELECT COUNT(*)::int AS n FROM scans WHERE qr_id = $1', [qr.id]);
    assert.equal(rows[0].n, 0);
  });
});
