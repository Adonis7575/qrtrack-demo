import QRCode from 'qrcode';

export const DEFAULT_STYLE = { fg: '#0f172a', bg: '#ffffff', margin: 2, ecc: 'M' };

export const COLOR_PRESETS = [
  { name: 'Ink', fg: '#0f172a', bg: '#ffffff' },
  { name: 'Black', fg: '#000000', bg: '#ffffff' },
  { name: 'Forest', fg: '#14532d', bg: '#f0fdf4' },
  { name: 'Navy', fg: '#1e3a8a', bg: '#eff6ff' },
  { name: 'Plum', fg: '#581c87', bg: '#faf5ff' },
  { name: 'Brick', fg: '#7f1d1d', bg: '#fff7ed' },
];

const STYLE_KEY = 'qrtrack:last-style';

export function loadLastStyle() {
  try {
    return { ...DEFAULT_STYLE, ...JSON.parse(localStorage.getItem(STYLE_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_STYLE };
  }
}

export function saveLastStyle(style) {
  try {
    localStorage.setItem(STYLE_KEY, JSON.stringify(style));
  } catch {
    // Storage may be unavailable (private mode); remembering the style is optional.
  }
}

function options(style = DEFAULT_STYLE, size = 1024) {
  const s = { ...DEFAULT_STYLE, ...style };
  return {
    width: size,
    margin: s.margin,
    errorCorrectionLevel: s.ecc,
    color: { dark: s.fg, light: s.bg },
  };
}

export function toPngDataUrl(text, style, size = 1024) {
  return QRCode.toDataURL(text, options(style, size));
}

export function toSvg(text, style, size = 1024) {
  return QRCode.toString(text, { ...options(style, size), type: 'svg' });
}

export async function toPngBlob(text, style, size = 1024) {
  // Decode the data URL directly; fetch(data:) is blocked by the page's CSP.
  const base64 = (await toPngDataUrl(text, style, size)).split(',')[1];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: 'image/png' });
}

export function fileBaseName(qr) {
  const slug = (qr.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug ? `${slug}-${qr.id}` : `qr-${qr.id}`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadQr(qr, format = 'png', size = 1024) {
  const name = fileBaseName(qr);
  if (format === 'svg') {
    const svg = await toSvg(qr.tracking_url, qr.style, size);
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${name}.svg`);
  } else {
    downloadBlob(await toPngBlob(qr.tracking_url, qr.style, size), `${name}.png`);
  }
}

export async function downloadZip(qrs, size = 1024) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const qr of qrs) {
    const name = fileBaseName(qr);
    zip.file(`${name}.png`, await toPngBlob(qr.tracking_url, qr.style, size));
    zip.file(`${name}.svg`, await toSvg(qr.tracking_url, qr.style, size));
  }
  downloadBlob(await zip.generateAsync({ type: 'blob' }), `qrtrack-${qrs.length}-codes.zip`);
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Most scanners expect dark modules on a light background with decent contrast.
 * Returns a warning string, or null when the colours are fine.
 */
export function scanWarning(style) {
  const fg = luminance(style.fg);
  const bg = luminance(style.bg);
  if (fg > bg) return 'Light code on a dark background — many phone cameras can’t read inverted codes.';
  const ratio = (bg + 0.05) / (fg + 0.05);
  if (ratio < 4) return 'Low contrast — some phones may struggle to scan this. Darken the code or lighten the background.';
  return null;
}

/** True when phones elsewhere on the network couldn't open this tracking URL. */
export function isLocalOnly(trackingUrl) {
  try {
    const { hostname } = new URL(trackingUrl);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}
