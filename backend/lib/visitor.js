const crypto = require('node:crypto');
const UAParser = require('ua-parser-js');

/**
 * Privacy-preserving visitor fingerprint: hash(ip, user-agent, UTC day, secret).
 * Raw IPs are never stored, and the daily salt means visitors can't be followed
 * across days.
 */
function buildFingerprint(ip, userAgent, secret, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  return crypto
    .createHash('sha256')
    .update(`${ip}::${userAgent}::${day}::${secret}`)
    .digest('hex');
}

// Link-preview fetchers (Slack, iMessage, WhatsApp...) and crawlers aren't scans.
const BOT_PATTERN = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|embedly|curl|wget|python-requests|headless/i;

function isBot(userAgent) {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

function describeDevice(userAgent) {
  const result = new UAParser(userAgent).getResult();
  const type = result.device.type;

  return {
    device: type === 'mobile' || type === 'tablet' ? type : 'desktop',
    browser: result.browser.name || 'Unknown',
    os: result.os.name || 'Unknown',
  };
}

module.exports = { buildFingerprint, describeDevice, isBot };
