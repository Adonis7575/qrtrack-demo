const ALLOWED_REDIRECT_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const MAX_LABEL_LENGTH = 120;
const MAX_TEXT_LENGTH = 4000;
const MAX_URL_LENGTH = 2048;
const CODE_PATTERN = /^[A-Za-z0-9_-]{3,40}$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const ERROR_LEVELS = new Set(['L', 'M', 'Q', 'H']);

const DEFAULT_STYLE = Object.freeze({
  fg: '#0f172a',
  bg: '#ffffff',
  margin: 2,
  ecc: 'M',
});

// "example.com/path", "www.shop.co.uk" — a bare domain someone pasted without https://
const BARE_DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i;

function normalizeLabel(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_LABEL_LENGTH) : null;
}

/**
 * Decides whether input is a URL or plain text. With type 'auto' (the default),
 * anything that parses as an allowed URL — or looks like a bare domain — is a URL.
 */
function detectType(raw) {
  // Any "scheme://" counts as a URL attempt, so ftp:// etc. get a clear error.
  if (/^([a-z][a-z0-9+.-]*:\/\/|mailto:|tel:)/i.test(raw)) return 'url';
  if (BARE_DOMAIN.test(raw)) return 'url';
  return 'text';
}

function parseUrl(raw) {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return { error: 'That doesn’t look like a valid URL' };
  }

  if (!ALLOWED_REDIRECT_PROTOCOLS.has(url.protocol)) {
    return { error: 'URL must use http, https, mailto, or tel' };
  }

  const href = url.toString();
  if (href.length > MAX_URL_LENGTH) {
    return { error: `URL must be ${MAX_URL_LENGTH} characters or fewer` };
  }

  return { value: href };
}

/**
 * Accepts { destination, type } (type: 'auto' | 'url' | 'text') and also the
 * older { destination_type, destination_url, text_content } shape.
 */
function validateDestination(body = {}) {
  let type = body.type || body.destination_type || 'auto';
  let raw = body.destination;

  if (raw === undefined) {
    raw = type === 'text' ? body.text_content : body.destination_url;
  }

  raw = typeof raw === 'string' ? raw.trim() : '';
  if (!raw) return { error: 'Enter a link or some text' };

  if (type === 'auto') type = detectType(raw);

  if (type === 'text') {
    if (raw.length > MAX_TEXT_LENGTH) {
      return { error: `Text must be ${MAX_TEXT_LENGTH} characters or fewer` };
    }
    return { value: { destination_type: 'text', destination_url: null, text_content: raw } };
  }

  if (type !== 'url') return { error: 'type must be auto, url, or text' };

  const { value: href, error } = parseUrl(raw);
  if (error) return { error };

  return { value: { destination_type: 'url', destination_url: href, text_content: null } };
}

function validateCode(value) {
  if (value === undefined || value === null || value === '') return { value: null };
  if (typeof value !== 'string' || !CODE_PATTERN.test(value.trim())) {
    return { error: 'Custom code must be 3–40 letters, numbers, - or _' };
  }
  return { value: value.trim() };
}

function normalizeStyle(value) {
  const input = value && typeof value === 'object' ? value : {};
  const margin = Number.parseInt(input.margin, 10);

  return {
    fg: HEX_COLOR.test(input.fg) ? input.fg.toLowerCase() : DEFAULT_STYLE.fg,
    bg: HEX_COLOR.test(input.bg) ? input.bg.toLowerCase() : DEFAULT_STYLE.bg,
    margin: Number.isNaN(margin) ? DEFAULT_STYLE.margin : Math.min(Math.max(margin, 0), 8),
    ecc: ERROR_LEVELS.has(input.ecc) ? input.ecc : DEFAULT_STYLE.ecc,
  };
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

module.exports = {
  DEFAULT_STYLE,
  MAX_LABEL_LENGTH,
  MAX_TEXT_LENGTH,
  clampInt,
  detectType,
  normalizeLabel,
  normalizeStyle,
  validateCode,
  validateDestination,
};
