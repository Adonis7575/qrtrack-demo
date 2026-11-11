import { useEffect, useState } from 'react';
import { toPngDataUrl } from '../utils/qr';

/** Renders a QR code client-side; re-renders whenever the text or style changes. */
export default function QRPreview({ text, style, size = 240, className, label = 'QR code' }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!text) return undefined;
    let cancelled = false;
    // Render at 2x for sharp edges on high-DPI screens.
    toPngDataUrl(text, style, size * 2)
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [text, style, size]);

  const box = { width: size, maxWidth: '100%', aspectRatio: '1', display: 'block' };
  if (!src) return <span className={className} style={box} />;

  return (
    <img
      src={src}
      className={className}
      style={{ ...box, height: 'auto' }}
      alt={label}
      aria-hidden={label ? undefined : true}
      draggable={false}
    />
  );
}
