const crypto = require('node:crypto');
const QRCode = require('qrcode');

const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 8 chars from an alphabet without look-alikes (0/O, 1/l/I). */
function generateId(length = 8) {
  const bytes = crypto.randomBytes(length);
  let id = '';
  for (const byte of bytes) id += ID_ALPHABET[byte % ID_ALPHABET.length];
  return id;
}

function qrOptions(style, size) {
  return {
    width: size,
    margin: style.margin,
    errorCorrectionLevel: style.ecc,
    color: { dark: style.fg, light: style.bg },
  };
}

function renderPng(text, style, size = 1024) {
  return QRCode.toBuffer(text, { ...qrOptions(style, size), type: 'png' });
}

function renderSvg(text, style, size = 1024) {
  return QRCode.toString(text, { ...qrOptions(style, size), type: 'svg' });
}

module.exports = { generateId, renderPng, renderSvg };
