import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, ExternalLink, Copy, Check, Pencil,
  Scan, Users, TrendingUp, Clock, Trash2, AlertCircle, AlertTriangle, RefreshCw, Loader,
} from 'lucide-react';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { useBreakdown, useQRDetail, useTimeline } from '../hooks/useData';
import { api } from '../utils/api';
import { describeDestination } from '../utils/destination';
import { downloadQr, isLocalOnly } from '../utils/qr';
import QRPreview from '../components/QRPreview';
import ScanChart from '../components/ScanChart';
import StatBadge from '../components/StatBadge';
import StylePicker from '../components/StylePicker';
import styles from './QRDetail.module.css';

export default function QRDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: qr, setData: setQr, loading: qrLoading, error: qrError, refetch } = useQRDetail(id);
  const { data: timeline, loading: chartLoading, refetch: refetchTimeline } = useTimeline(id, days);
  const { data: breakdown, refetch: refetchBreakdown } = useBreakdown(id);

  const refreshAll = () => {
    refetch();
    refetchTimeline();
    refetchBreakdown();
    setRefreshKey((k) => k + 1);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qr.tracking_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link is visible and selectable.
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.deleteQR(id);
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  };

  if (qrLoading && !qr) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading QR analytics…</p>
        </div>
      </div>
    );
  }

  if (qrError || !qr) {
    return (
      <div className={styles.page}>
        <div className={styles.errorState}>
          <AlertCircle size={32} />
          <p>{qrError || 'QR code not found'}</p>
          <button onClick={() => navigate('/')} className={styles.backLink}>
            <ArrowLeft size={13} /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const uniqueRate = qr.total_scans > 0 ? Math.round((qr.unique_scans / qr.total_scans) * 100) : 0;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>
          <ArrowLeft size={14} /> Dashboard
        </button>
        <div className={styles.headerRow}>
          <div>
            <div className={styles.idBadge}>#{qr.id}</div>
            <h1 className={styles.pageTitle}>{qr.label || 'Untitled QR code'}</h1>
            <div className={styles.createdAt}>
              <Clock size={11} />
              Created {formatDistanceToNow(new Date(qr.created_at), { addSuffix: true })}
            </div>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.btnIcon} onClick={refreshAll} title="Refresh" aria-label="Refresh">
              <RefreshCw size={14} />
            </button>
            <button className={styles.btnIcon} onClick={() => setEditing(true)} title="Edit" aria-label="Edit">
              <Pencil size={14} />
            </button>
            <button
              className={`${styles.btnIcon} ${styles.btnDanger}`}
              onClick={() => setConfirmingDelete(true)}
              disabled={deleting}
              title="Delete QR code"
              aria-label="Delete QR code"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.leftPanel}>
          <div className={styles.qrCard}>
            <div className={styles.qrImageWrap} style={{ background: qr.style.bg }}>
              <QRPreview text={qr.tracking_url} style={qr.style} size={200} label={`QR code for ${qr.label || qr.id}`} />
            </div>

            <div className={styles.qrActions}>
              <DownloadButton qr={qr} format="png" />
              <DownloadButton qr={qr} format="svg" />
            </div>
          </div>

          {isLocalOnly(qr.tracking_url) && (
            <p className={styles.warning}>
              <AlertTriangle size={13} />
              <span>This code points at <code>localhost</code>, so phones can’t open it. Set <code>BASE_URL</code> before printing.</span>
            </p>
          )}

          <div className={styles.destinationCard}>
            <div className={styles.cardHead}>
              <p className={styles.cardLabel}>{qr.destination_type === 'text' ? 'Shows this text' : 'Sends people to'}</p>
              <button className={styles.textBtn} onClick={() => setEditing(true)}>Change</button>
            </div>
            {qr.destination_type === 'text' ? (
              <div className={styles.textDestination}>{qr.text_content}</div>
            ) : (
              <a href={qr.destination_url} target="_blank" rel="noopener noreferrer" className={styles.destUrl}>
                <ExternalLink size={12} />
                <span>{qr.destination_url}</span>
              </a>
            )}
          </div>

          <div className={styles.destinationCard}>
            <p className={styles.cardLabel}>Tracking link (what the code contains)</p>
            <div className={styles.trackRow}>
              <code className={styles.trackCode}>{qr.tracking_url}</code>
              <button className={styles.inlineCopy} onClick={handleCopy} aria-label="Copy tracking link">
                {copied ? <Check size={11} /> : <Copy size={11} />}
              </button>
            </div>
          </div>
        </div>

        <div className={styles.rightPanel}>
          <div className={styles.statsGrid}>
            <StatBadge icon={<Scan size={16} />} label="Total scans" value={(qr.total_scans ?? 0).toLocaleString()} accent />
            <StatBadge icon={<Users size={16} />} label="Unique visitors" value={(qr.unique_scans ?? 0).toLocaleString()} />
            <StatBadge icon={<TrendingUp size={16} />} label="Unique rate" value={qr.total_scans > 0 ? `${uniqueRate}%` : '—'} />
          </div>

          {chartLoading && !timeline ? (
            <div className={styles.chartSkeleton} />
          ) : (
            <ScanChart data={timeline || []} days={days} onDaysChange={setDays} />
          )}

          {breakdown && qr.total_scans > 0 && <Breakdown breakdown={breakdown} />}

          <RecentScans key={refreshKey} qrId={id} />
        </div>
      </div>

      {editing && (
        <EditModal
          qr={qr}
          onClose={() => setEditing(false)}
          onSaved={(updated) => { setQr(updated); setEditing(false); }}
        />
      )}

      {confirmingDelete && (
        <div className={styles.modalOverlay} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title" className={styles.modalTitle}>
              Delete {qr.label || `#${qr.id}`}?
            </h3>
            <p className={styles.modalText}>
              Printed copies will stop working, and {(qr.total_scans ?? 0).toLocaleString()} scan events
              will be removed. This can’t be undone.
            </p>
            {deleteError && <p className={styles.modalError}>{deleteError}</p>}
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                Cancel
              </button>
              <button className={styles.modalDanger} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete QR code'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DownloadButton({ qr, format }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await downloadQr(qr, format);
    } catch (err) {
      console.error('Download failed', err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className={styles.dlBtn} onClick={run} disabled={busy}>
      {busy ? <Loader size={13} className={styles.spin} /> : <Download size={13} />} {format.toUpperCase()}
    </button>
  );
}

/* ─── Edit ───────────────────────────────────────────────────────────────────── */
function EditModal({ qr, onClose, onSaved }) {
  const initial = qr.destination_type === 'text' ? qr.text_content : qr.destination_url;
  const [destination, setDestination] = useState(initial);
  const [type, setType] = useState(qr.destination_type);
  const [label, setLabel] = useState(qr.label || '');
  const [style, setStyle] = useState(qr.style);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const detected = describeDestination(destination, type);

  const save = async (e) => {
    e.preventDefault();
    if (detected.empty || detected.error) {
      setError(detected.error || 'Enter a link or some text');
      return;
    }
    setSaving(true);
    setError('');
    try {
      onSaved(await api.updateQR(qr.id, { destination, type, label, style }));
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} role="presentation">
      <form className={`${styles.modal} ${styles.editModal}`} role="dialog" aria-modal="true" aria-labelledby="edit-title" onSubmit={save}>
        <h3 id="edit-title" className={styles.modalTitle}>Edit QR code</h3>
        <p className={styles.modalText}>
          The printed code doesn’t change — scans just go to the new destination.
        </p>

        <label className={styles.editLabel} htmlFor="edit-label">Name</label>
        <input id="edit-label" className={styles.editInput} value={label} onChange={(e) => setLabel(e.target.value)} />

        <div className={styles.editTypeRow}>
          <span className={styles.editLabel}>{type === 'text' ? 'Text' : 'Link'}</span>
          <button type="button" className={styles.textBtn} onClick={() => setType(type === 'text' ? 'url' : 'text')}>
            Switch to {type === 'text' ? 'link' : 'text'}
          </button>
        </div>
        <textarea
          className={styles.editInput}
          rows={type === 'text' ? 4 : 2}
          value={destination}
          onChange={(e) => { setDestination(e.target.value); setError(''); }}
          autoFocus
        />
        {detected.url && detected.url !== destination.trim() && (
          <span className={styles.editHint}>Will open {detected.url}</span>
        )}

        <span className={styles.editLabel}>Colours</span>
        <StylePicker value={style} onChange={setStyle} disabled={saving} />

        {error && <p className={styles.modalError}>{error}</p>}

        <div className={styles.modalActions}>
          <button type="button" className={styles.modalCancel} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className={styles.modalPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── Breakdown ──────────────────────────────────────────────────────────────── */
const DIMENSIONS = [
  ['device', 'Device'],
  ['os', 'System'],
  ['browser', 'Browser'],
];

function Breakdown({ breakdown }) {
  return (
    <div className={styles.breakdown}>
      {DIMENSIONS.map(([key, title]) => {
        const rows = breakdown[key] || [];
        const total = rows.reduce((sum, r) => sum + r.count, 0) || 1;
        return (
          <div key={key} className={styles.breakdownCol}>
            <p className={styles.cardLabel}>{title}</p>
            {rows.slice(0, 5).map((row) => (
              <div key={row.name} className={styles.barRow}>
                <div className={styles.barText}>
                  <span>{row.name}</span>
                  <span className={styles.mono}>{Math.round((row.count / total) * 100)}%</span>
                </div>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${(row.count / total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Recent scans ───────────────────────────────────────────────────────────── */
function RecentScans({ qrId }) {
  const [scans, setScans] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const toggle = async () => {
    if (scans) { setOpen(!open); return; }
    setLoading(true);
    setOpen(true);
    try {
      setScans(await api.getScans(qrId, 50));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.recentScans}>
      <button className={styles.recentToggle} onClick={toggle} aria-expanded={open}>
        <span>Recent scans</span>
        <span className={styles.toggleArrow}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.scanTable}>
          {loading ? (
            <div className={styles.tableLoading}>Loading scans…</div>
          ) : error ? (
            <div className={styles.tableEmpty}>{error}</div>
          ) : !scans?.length ? (
            <div className={styles.tableEmpty}>No scans yet. Point a phone camera at the code to test it.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Visitor</th>
                  <th>Device</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((scan) => (
                  <tr key={scan.id}>
                    <td className={styles.mono}>{format(parseISO(scan.scanned_at), 'MMM d, HH:mm')}</td>
                    <td>
                      <span className={`${styles.typePill} ${scan.is_unique ? styles.unique : styles.repeat}`}>
                        {scan.is_unique ? 'New' : 'Repeat'}
                      </span>
                    </td>
                    <td className={styles.ua}>{[scan.device, scan.os, scan.browser].filter(Boolean).join(' · ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
