// Mirrors backend/lib/validation.js so the form can show what will happen
// before anything is sent. The server re-validates everything.

const ALLOWED = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const BARE_DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i;
export const CODE_PATTERN = /^[A-Za-z0-9_-]{3,40}$/;

export function detectType(raw) {
  if (/^([a-z][a-z0-9+.-]*:\/\/|mailto:|tel:)/i.test(raw)) return 'url';
  if (BARE_DOMAIN.test(raw)) return 'url';
  return 'text';
}

/**
 * Returns { type, url?, error? } for the trimmed input. `forced` overrides
 * auto-detection ('url' | 'text' | null).
 */
export function describeDestination(input, forced = null) {
  const raw = input.trim();
  if (!raw) return { type: forced || 'url', empty: true };

  const type = forced || detectType(raw);
  if (type === 'text') return { type };

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!ALLOWED.has(url.protocol)) return { type, error: 'Links must start with http, https, mailto, or tel.' };
    return { type, url: url.toString() };
  } catch {
    return { type, error: 'That doesn’t look like a valid link.' };
  }
}

/**
 * Bulk input: one code per line. A label can come first, separated by a tab
 * (pasted from a spreadsheet) or a comma: "Spring menu, example.com/menu".
 */
export function parseBulk(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf('\t');
      if (tab > 0) {
        return { label: line.slice(0, tab).trim(), destination: line.slice(tab + 1).trim() };
      }
      const comma = line.match(/^(.+?),\s*(\S+)$/);
      if (comma && detectType(comma[2]) === 'url') {
        return { label: comma[1].trim(), destination: comma[2] };
      }
      return { label: '', destination: line };
    });
}
