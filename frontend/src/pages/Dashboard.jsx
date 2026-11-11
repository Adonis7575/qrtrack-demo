import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  QrCode, Scan, Users, TrendingUp, Plus, RefreshCw, AlertCircle, Search, Layers, Loader, ArrowRight,
} from 'lucide-react';
import { useOverview } from '../hooks/useData';
import { api } from '../utils/api';
import { describeDestination } from '../utils/destination';
import { loadLastStyle } from '../utils/qr';
import QRCard from '../components/QRCard';
import StatBadge from '../components/StatBadge';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useOverview();
  const [deleting, setDeleting] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [query, setQuery] = useState('');

  const handleDelete = async () => {
    const id = pendingDelete?.id;
    if (!id) return;

    setDeleting(id);
    setDeleteError('');
    try {
      await api.deleteQR(id);
      setPendingDelete(null);
      await refetch();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const qrCodes = data?.qr_codes || [];
  const totals = data?.totals || {};
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? qrCodes.filter((qr) =>
        [qr.id, qr.label, qr.destination_url, qr.text_content]
          .some((field) => field?.toLowerCase().includes(needle)))
    : qrCodes;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Dashboard</h1>
          <p className={styles.pageSubtitle}>
            {loading && !data ? 'Loading…' : `${totals.qr_count ?? 0} QR code${totals.qr_count === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnGhost} onClick={refetch} title="Refresh" aria-label="Refresh">
            <RefreshCw size={14} />
          </button>
          <button className={styles.btnSecondary} onClick={() => navigate('/generate?mode=bulk')}>
            <Layers size={14} /> Bulk
          </button>
          <button className={styles.btnPrimary} onClick={() => navigate('/generate')}>
            <Plus size={15} /> New QR code
          </button>
        </div>
      </div>

      <QuickCreate onCreated={(qr) => navigate(`/qr/${qr.id}`)} />

      <div className={styles.statsRow}>
        <StatBadge icon={<QrCode size={16} />} label="QR codes" value={totals.qr_count ?? 0} />
        <StatBadge icon={<Scan size={16} />} label="Total scans" value={(totals.total_scans ?? 0).toLocaleString()} accent />
        <StatBadge icon={<Users size={16} />} label="Unique visitors" value={(totals.unique_scans ?? 0).toLocaleString()} />
        <StatBadge
          icon={<TrendingUp size={16} />}
          label="Unique rate"
          value={totals.total_scans > 0 ? `${Math.round((totals.unique_scans / totals.total_scans) * 100)}%` : '—'}
        />
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
          <button onClick={refetch} className={styles.retryBtn}>Retry</button>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>QR codes</h2>
          {qrCodes.length > 0 && <span className={styles.count}>{visible.length}</span>}
          {qrCodes.length > 3 && (
            <label className={styles.search}>
              <Search size={13} />
              <input
                type="search"
                placeholder="Search name, code or link"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search QR codes"
              />
            </label>
          )}
        </div>

        {loading && !data ? (
          <div className={styles.skeletonGrid}>
            {[1, 2, 3].map((i) => <div key={i} className={styles.skeleton} />)}
          </div>
        ) : qrCodes.length === 0 ? (
          <div className={styles.empty}>
            <QrCode size={40} className={styles.emptyIcon} />
            <p>No QR codes yet. Paste a link above to make your first one.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className={styles.empty}><p>Nothing matches “{query}”.</p></div>
        ) : (
          <div className={styles.grid}>
            {visible.map((qr) => (
              <div key={qr.id} className={deleting === qr.id ? styles.deleting : ''}>
                <QRCard qr={qr} onDelete={(item) => { setDeleteError(''); setPendingDelete(item); }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingDelete && (
        <div className={styles.modalOverlay} role="presentation" onClick={() => !deleting && setPendingDelete(null)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-title" className={styles.modalTitle}>
              Delete {pendingDelete.label || `#${pendingDelete.id}`}?
            </h3>
            <p className={styles.modalText}>
              Printed copies will stop working, and {(pendingDelete.total_scans ?? 0).toLocaleString()} scan
              events will be removed. This can’t be undone.
            </p>
            {deleteError && <p className={styles.modalError}>{deleteError}</p>}
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setPendingDelete(null)} disabled={!!deleting}>
                Cancel
              </button>
              <button className={styles.modalDanger} onClick={handleDelete} disabled={!!deleting}>
                {deleting ? 'Deleting…' : 'Delete QR code'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Paste a link, press Enter, get a QR code — using the last colours you picked. */
function QuickCreate({ onCreated }) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const detected = describeDestination(value);

  const submit = async (e) => {
    e.preventDefault();
    if (detected.empty || detected.error) {
      setError(detected.error || '');
      return;
    }
    setLoading(true);
    setError('');
    try {
      onCreated(await api.createQR({ destination: value, style: loadLastStyle() }));
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form className={styles.quick} onSubmit={submit}>
      <input
        className={styles.quickInput}
        placeholder="Paste a link to make a QR code instantly…"
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(''); }}
        disabled={loading}
        aria-label="Link or text for a new QR code"
      />
      <button className={styles.quickBtn} disabled={loading || detected.empty} aria-label="Create QR code">
        {loading ? <Loader size={15} className={styles.spin} /> : <ArrowRight size={16} />}
      </button>
      {error && <p className={styles.quickError}>{error}</p>}
    </form>
  );
}
