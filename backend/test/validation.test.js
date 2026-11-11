const assert = require('node:assert/strict');
const test = require('node:test');
const {
  detectType,
  normalizeLabel,
  normalizeStyle,
  validateCode,
  validateDestination,
} = require('../lib/validation');

test('detectType recognises URLs, bare domains and plain text', () => {
  assert.equal(detectType('https://example.com'), 'url');
  assert.equal(detectType('example.com/menu?table=4'), 'url');
  assert.equal(detectType('www.shop.co.uk'), 'url');
  assert.equal(detectType('mailto:hi@example.com'), 'url');
  assert.equal(detectType('Wi-Fi password is hunter2'), 'text');
  assert.equal(detectType('version 1.2'), 'text');
});

test('validateDestination adds https:// to bare domains', () => {
  const { value } = validateDestination({ destination: 'example.com/path' });
  assert.deepEqual(value, {
    destination_type: 'url',
    destination_url: 'https://example.com/path',
    text_content: null,
  });
});

test('validateDestination rejects unsafe schemes', () => {
  assert.equal(
    validateDestination({ type: 'url', destination: 'javascript:alert(1)' }).error,
    'URL must use http, https, mailto, or tel'
  );
  assert.ok(validateDestination({ type: 'url', destination: 'data:text/plain,hi' }).error);
});

test('validateDestination keeps text as text', () => {
  const { value } = validateDestination({ destination: '  hello there  ' });
  assert.deepEqual(value, { destination_type: 'text', destination_url: null, text_content: 'hello there' });
});

test('validateDestination accepts the legacy field names', () => {
  const { value } = validateDestination({ destination_type: 'url', destination_url: 'https://a.io' });
  assert.equal(value.destination_url, 'https://a.io/');
});

test('validateDestination requires input', () => {
  assert.ok(validateDestination({ destination: '   ' }).error);
});

test('validateCode allows friendly slugs only', () => {
  assert.equal(validateCode('spring-menu').value, 'spring-menu');
  assert.equal(validateCode(undefined).value, null);
  assert.ok(validateCode('no spaces').error);
  assert.ok(validateCode('ab').error);
});

test('normalizeStyle falls back to defaults for bad values', () => {
  assert.deepEqual(normalizeStyle({ fg: 'red', bg: '#FFFFFF', margin: 99, ecc: 'Z' }), {
    fg: '#0f172a',
    bg: '#ffffff',
    margin: 8,
    ecc: 'M',
  });
});

test('normalizeLabel trims and caps labels', () => {
  assert.equal(normalizeLabel('  Campaign  '), 'Campaign');
  assert.equal(normalizeLabel('x'.repeat(130)).length, 120);
  assert.equal(normalizeLabel('   '), null);
});
