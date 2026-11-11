import { useNavigate } from 'react-router-dom';
import { Scan, Users, ExternalLink, Type, Trash2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import QRPreview from './QRPreview';
import styles from './QRCard.module.css';

export default function QRCard({ qr, onDelete }) {
  const navigate = useNavigate();
  const open = () => navigate(`/qr/${qr.id}`);

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(qr);
  };

  const uniqueRate =
    qr.total_scans > 0
      ? Math.round((qr.unique_scans / qr.total_scans) * 100)
      : 0;

  const timeAgo = formatDistanceToNow(new Date(qr.created_at), { addSuffix: true });
  const isText = qr.destination_type === 'text';
  const DestinationIcon = isText ? Type : ExternalLink;

  return (
    <div
      className={styles.card}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter') open(); }}
      role="link"
      tabIndex={0}
      aria-label={`Open ${qr.label || qr.id}`}
    >
      <div className={styles.header}>
        <div className={styles.thumb} style={{ background: qr.style?.bg }}>
          <QRPreview text={qr.tracking_url} style={qr.style} size={52} label="" />
        </div>
        <div className={styles.meta}>
          <span className={styles.id}>#{qr.id}</span>
          <h3 className={styles.label}>{qr.label || 'Untitled'}</h3>
        </div>
        <button
          className={styles.deleteBtn}
          onClick={handleDelete}
          title="Delete QR code"
          aria-label={`Delete ${qr.label || qr.id}`}
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className={styles.url}>
        <DestinationIcon size={11} className={styles.urlIcon} />
        <span className={styles.urlText}>{isText ? qr.text_content : qr.destination_url}</span>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <Scan size={13} />
          <span className={styles.statVal}>{qr.total_scans ?? 0}</span>
          <span className={styles.statLabel}>total</span>
        </div>
        <div className={styles.stat}>
          <Users size={13} />
          <span className={styles.statVal}>{qr.unique_scans ?? 0}</span>
          <span className={styles.statLabel}>unique</span>
        </div>
        {qr.total_scans > 0 && (
          <div className={`${styles.stat} ${styles.statRate}`}>
            <span className={styles.rateVal}>{uniqueRate}%</span>
            <span className={styles.statLabel}>unique rate</span>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <Clock size={10} />
        <span>{timeAgo}</span>
      </div>
    </div>
  );
}
