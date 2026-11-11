import { AlertTriangle } from 'lucide-react';
import { COLOR_PRESETS, scanWarning } from '../utils/qr';
import styles from './StylePicker.module.css';

export default function StylePicker({ value, onChange, disabled }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const warning = scanWarning(value);

  return (
    <div className={styles.picker}>
      <div className={styles.presets} role="group" aria-label="Colour presets">
        {COLOR_PRESETS.map((preset) => {
          const active = preset.fg === value.fg && preset.bg === value.bg;
          return (
            <button
              key={preset.name}
              type="button"
              className={`${styles.swatch} ${active ? styles.swatchActive : ''}`}
              style={{ background: preset.bg }}
              onClick={() => set({ fg: preset.fg, bg: preset.bg })}
              disabled={disabled}
              title={preset.name}
              aria-label={`${preset.name} colours`}
              aria-pressed={active}
            >
              <span style={{ background: preset.fg }} />
            </button>
          );
        })}
      </div>

      <div className={styles.colors}>
        <label className={styles.color}>
          <input type="color" value={value.fg} onChange={(e) => set({ fg: e.target.value })} disabled={disabled} />
          <span>Code</span>
        </label>
        <label className={styles.color}>
          <input type="color" value={value.bg} onChange={(e) => set({ bg: e.target.value })} disabled={disabled} />
          <span>Background</span>
        </label>
        <label className={styles.color}>
          <select
            value={value.margin}
            onChange={(e) => set({ margin: Number(e.target.value) })}
            disabled={disabled}
          >
            {[0, 1, 2, 4, 6].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <span>Quiet zone</span>
        </label>
      </div>

      {warning && (
        <p className={styles.warning}>
          <AlertTriangle size={13} />
          <span>{warning}</span>
        </p>
      )}
    </div>
  );
}
