import styles from './StatBadge.module.css';

export default function StatBadge({ label, value, accent = false, icon }) {
  return (
    <div className={`${styles.badge} ${accent ? styles.accent : ''}`}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.value}>{value ?? '—'}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
