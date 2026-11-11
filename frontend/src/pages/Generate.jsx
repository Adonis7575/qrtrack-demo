import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Link, Type, Download, Copy, Check, ChevronRight, ChevronDown,
  Loader, AlertCircle, AlertTriangle, Layers, Sparkles, FileDown,
} from 'lucide-react';
import { api } from '../utils/api';
import { describeDestination, parseBulk, CODE_PATTERN } from '../utils/destination';
import {
  downloadBlob, downloadQr, downloadZip, isLocalOnly, loadLastStyle, saveLastStyle,
} from '../utils/qr';
import QRPreview from '../components/QRPreview';
import StylePicker from '../components/StylePicker';
import styles from './Generate.module.css';

const sameStyle = (a, b) => Boolean(a && b)
  && ['fg', 'bg', 'margin', 'ecc'].every((key) => a[key] === b[key]);

export default function Generate() {
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'bulk' ? 'bulk' : 'single';
  const [style, setStyle] = useState(loadLastStyle);

  const setMode = (next) => setParams(next === 'bulk' ? { mode: 'bulk' } : {}, { replace: true });

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Create QR codes</h1>
        <p className={styles.pageSubtitle}>
          Paste a link or type a message. Every code is trackable, and you can change where it points later.
        </p>
      </div>

      <div className={styles.typeToggle} role="tablist">
        <button
          role="tab"
          aria-selected={mode === 'single'}
          className={`${styles.typeBtn} ${mode === 'single' ? styles.typeBtnActive : ''}`}
          onClick={() => setMode('single')}
        >
          <Sparkles size={14} /> Single
        </button>
        <button
          role="tab"
          aria-selected={mode === 'bulk'}
          className={`${styles.typeBtn} ${mode === 'bulk' ? styles.typeBtnActive : ''}`}
          onClick={() => setMode('bulk')}
        >
          <Layers size={14} /> Bulk
        </button>
      </div>

      {mode === 'single'
        ? <SingleCreate style={style} setStyle={setStyle} />
        : <BulkCreate style={style} setStyle={setStyle} />}
    </div>
  );
}

/* ─── Single ─────────────────────────────────────────────────────────────────── */

function SingleCreate({ style, setStyle }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [input, setInput] = useState('');
  const [forced, setForced] = useState(null);
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(null);

  const detected = describeDestination(input, forced);
  const codeError = code && !CODE_PATTERN.test(code) ? '3–40 letters, numbers, - or _' : '';
  const canSubmit = !detected.empty && !detected.error && !codeError && !loading;

  useEffect(() => { inputRef.current?.focus(); }, []);

  // On narrow screens the result sits below the form; bring it into view.
  const previewRef = useRef(null);
  useEffect(() => {
    if (result && window.matchMedia('(max-width: 960px)').matches) {
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  // After creation, colour changes are saved to the code automatically.
  const savedStyle = useRef(null);
  useEffect(() => {
    if (!result) return undefined;
    if (sameStyle(savedStyle.current, style)) return undefined;
    const timer = setTimeout(() => {
      api.updateQR(result.id, { style })
        .then((updated) => { savedStyle.current = updated.style; })
        .catch((err) => setError(`Couldn’t save colours: ${err.message}`));
    }, 500);
    return () => clearTimeout(timer);
  }, [style, result]);

  const handleCreate = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.createQR({
        destination: input,
        type: forced || 'auto',
        label: label || undefined,
        code: code || undefined,
        style,
      });
      savedStyle.current = data.style;
      saveLastStyle(style);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setInput('');
    setLabel('');
    setCode('');
    setForced(null);
    setError('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.tracking_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Couldn’t copy — select the link and copy it manually.');
    }
  };

  const handleDownload = async (format) => {
    setDownloading(format);
    try {
      await downloadQr({ ...result, style }, format);
    } catch (err) {
      setError(`Download failed: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const previewUrl = result?.tracking_url
    || `${window.location.origin}/r/${code && !codeError ? code : 'xxxxxxxx'}`;
  const locked = Boolean(result) || loading;

  return (
    <div className={styles.layout}>
      <form
        className={styles.formPanel}
        onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
      >
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="destination">Link or text</label>
          <textarea
            id="destination"
            ref={inputRef}
            className={`${styles.input} ${styles.bigInput}`}
            placeholder="example.com/menu — or any message"
            value={input}
            rows={2}
            onChange={(e) => { setInput(e.target.value); setError(''); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleCreate();
              }
            }}
            disabled={locked}
          />
          {!detected.empty && (
            <div className={styles.detected}>
              {detected.error ? (
                <span className={styles.detectedError}><AlertCircle size={12} /> {detected.error}</span>
              ) : detected.type === 'url' ? (
                <span><Link size={12} /> Opens <code>{detected.url}</code></span>
              ) : (
                <span><Type size={12} /> Shows this text on a page when scanned</span>
              )}
              {!locked && (
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => setForced(detected.type === 'url' ? 'text' : 'url')}
                >
                  Treat as {detected.type === 'url' ? 'text' : 'a link'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="label">
            Name <span className={styles.optional}>(optional, just for you)</span>
          </label>
          <input
            id="label"
            type="text"
            className={styles.input}
            placeholder="e.g. Table tent — spring menu"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={locked}
          />
        </div>

        <div className={styles.more}>
          <button
            type="button"
            className={styles.moreToggle}
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
          >
            <ChevronDown size={14} className={showMore ? styles.chevronOpen : ''} />
            Colours & custom link
          </button>

          {showMore && (
            <div className={styles.moreBody}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Colours</span>
                <StylePicker value={style} onChange={setStyle} disabled={loading} />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="code">
                  Custom code <span className={styles.optional}>(optional)</span>
                </label>
                <div className={styles.prefixInput}>
                  <span>/r/</span>
                  <input
                    id="code"
                    type="text"
                    placeholder="spring-menu"
                    value={code}
                    onChange={(e) => { setCode(e.target.value.trim()); setError(''); }}
                    disabled={locked}
                    spellCheck={false}
                  />
                </div>
                {codeError && <span className={styles.hintError}>{codeError}</span>}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className={styles.errorMsg} role="alert">
            <AlertCircle size={13} />
            <span>{error}</span>
          </div>
        )}

        {!result && (
          <button type="submit" className={styles.generateBtn} disabled={!canSubmit}>
            {loading
              ? <><Loader size={15} className={styles.spin} /> Creating…</>
              : <>Create QR code <ChevronRight size={15} /></>}
          </button>
        )}
        {!result && <p className={styles.kbdHint}>Press Enter to create · Shift+Enter for a new line</p>}
      </form>

      <div className={styles.previewPanel} ref={previewRef}>
        <div className={`${styles.resultCard} ${result ? styles.resultReady : ''}`}>
          <div className={styles.qrImageWrap} style={{ background: style.bg }}>
            <QRPreview
              text={previewUrl}
              style={style}
              size={220}
              className={result ? '' : styles.previewDim}
              label={result ? `QR code for ${result.label || result.id}` : 'Preview'}
            />
            {!result && <span className={styles.previewTag}>Preview</span>}
          </div>

          {result ? (
            <>
              <div className={styles.trackingUrl}>
                <span className={styles.trackingLabel}>Your tracking link</span>
                <div className={styles.trackingRow}>
                  <code className={styles.trackingCode}>{result.tracking_url}</code>
                  <button type="button" className={styles.copyBtn} onClick={handleCopy} aria-label="Copy link">
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              {isLocalOnly(result.tracking_url) && <LocalhostWarning />}

              <div className={styles.downloads}>
                <button type="button" className={styles.dlBtn} onClick={() => handleDownload('png')} disabled={!!downloading}>
                  {downloading === 'png' ? <Loader size={13} className={styles.spin} /> : <Download size={13} />} PNG
                </button>
                <button type="button" className={styles.dlBtn} onClick={() => handleDownload('svg')} disabled={!!downloading}>
                  {downloading === 'svg' ? <Loader size={13} className={styles.spin} /> : <Download size={13} />} SVG
                </button>
              </div>

              <div className={styles.resultActions}>
                <button type="button" className={styles.viewBtn} onClick={() => navigate(`/qr/${result.id}`)}>
                  View analytics <ChevronRight size={14} />
                </button>
                <button type="button" className={styles.newBtn} onClick={reset}>
                  Create another
                </button>
              </div>
            </>
          ) : (
            <p className={styles.previewHint}>
              Scans go through your tracking link, then on to the destination.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function LocalhostWarning() {
  return (
    <p className={styles.warning}>
      <AlertTriangle size={13} />
      <span>
        This link points at <code>localhost</code>, so phones can’t open it. Set <code>BASE_URL</code> to an
        address phones can reach (your deployed URL or LAN IP) before printing.
      </span>
    </p>
  );
}

/* ─── Bulk ───────────────────────────────────────────────────────────────────── */

const BULK_EXAMPLE = `Spring menu, example.com/menu
Wi-Fi poster, example.com/wifi
https://example.com/feedback`;

function BulkCreate({ style, setStyle }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [zipping, setZipping] = useState(false);

  const rows = useMemo(() => parseBulk(text), [text]);
  const rowChecks = rows.map((row) => describeDestination(row.destination));
  const invalid = rowChecks.filter((check) => check.error).length;
  const valid = rows.length - invalid;

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.createBulk(rows, style);
      saveLastStyle(style);
      setResult({ ...data, rows });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleZip = async () => {
    setZipping(true);
    try {
      await downloadZip(result.created);
    } catch (err) {
      setError(`Download failed: ${err.message}`);
    } finally {
      setZipping(false);
    }
  };

  const handleCsv = () => {
    const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['name', 'destination', 'tracking_url', 'code'].join(','),
      ...result.created.map((qr) => [
        qr.label, qr.destination_url || qr.text_content, qr.tracking_url, qr.id,
      ].map(quote).join(',')),
    ];
    downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv' }), 'qrtrack-codes.csv');
  };

  if (result) {
    return (
      <div className={styles.bulkResult}>
        <div className={styles.bulkSummary}>
          <p>
            <strong>{result.created.length}</strong> code{result.created.length === 1 ? '' : 's'} created
            {result.errors.length > 0 && <>, <span className={styles.errText}>{result.errors.length} skipped</span></>}
          </p>
          <div className={styles.bulkActions}>
            <button type="button" className={styles.viewBtn} onClick={handleZip} disabled={zipping || !result.created.length}>
              {zipping ? <Loader size={14} className={styles.spin} /> : <Download size={14} />} Download all (ZIP)
            </button>
            <button type="button" className={styles.dlBtn} onClick={handleCsv} disabled={!result.created.length}>
              <FileDown size={13} /> CSV
            </button>
            <button type="button" className={styles.newBtn} onClick={() => { setResult(null); setText(''); }}>
              Create more
            </button>
          </div>
        </div>

        {error && (
          <div className={styles.errorMsg} role="alert">
            <AlertCircle size={13} />
            <span>{error}</span>
          </div>
        )}

        {result.created.some((qr) => isLocalOnly(qr.tracking_url)) && <LocalhostWarning />}

        {result.errors.length > 0 && (
          <ul className={styles.bulkErrors}>
            {result.errors.map((e) => (
              <li key={e.index}>
                <code>{result.rows[e.index].destination}</code> — {e.error}
              </li>
            ))}
          </ul>
        )}

        <div className={styles.bulkGrid}>
          {result.created.map((qr) => (
            <RouterLink key={qr.id} to={`/qr/${qr.id}`} className={styles.bulkItem}>
              <div className={styles.bulkThumb} style={{ background: qr.style.bg }}>
                <QRPreview text={qr.tracking_url} style={qr.style} size={88} />
              </div>
              <div className={styles.bulkMeta}>
                <strong>{qr.label || `#${qr.id}`}</strong>
                <span>{qr.destination_url || qr.text_content}</span>
              </div>
            </RouterLink>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <div className={styles.formPanel}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="bulk">One code per line</label>
          <textarea
            id="bulk"
            className={`${styles.input} ${styles.bulkInput}`}
            placeholder={BULK_EXAMPLE}
            value={text}
            onChange={(e) => { setText(e.target.value); setError(''); }}
            disabled={loading}
            spellCheck={false}
          />
          <span className={styles.hint}>
            Put a name first with a comma (<code>Name, example.com</code>) or paste two columns straight from a spreadsheet.
          </span>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Colours for all codes</span>
          <StylePicker value={style} onChange={setStyle} disabled={loading} />
        </div>

        {error && (
          <div className={styles.errorMsg} role="alert">
            <AlertCircle size={13} />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          className={styles.generateBtn}
          onClick={handleCreate}
          disabled={loading || valid === 0 || rows.length > 200}
        >
          {loading
            ? <><Loader size={15} className={styles.spin} /> Creating {valid} codes…</>
            : <>Create {valid || ''} QR code{valid === 1 ? '' : 's'} <ChevronRight size={15} /></>}
        </button>
        {rows.length > 200 && <span className={styles.hintError}>Up to 200 codes at a time.</span>}
      </div>

      <div className={styles.previewPanel}>
        <div className={styles.bulkPreview}>
          <p className={styles.trackingLabel}>
            {rows.length ? `${rows.length} line${rows.length === 1 ? '' : 's'}` : 'Lines will appear here'}
            {invalid > 0 && <span className={styles.errText}> · {invalid} will be skipped</span>}
          </p>
          <ol className={styles.bulkList}>
            {rows.slice(0, 50).map((row, i) => (
              <li key={i} className={rowChecks[i].error ? styles.bulkBad : ''}>
                {row.label && <strong>{row.label}</strong>}
                <span>
                  {rowChecks[i].error
                    ? rowChecks[i].error
                    : rowChecks[i].type === 'url' ? rowChecks[i].url : `Text: ${row.destination}`}
                </span>
              </li>
            ))}
          </ol>
          {rows.length > 50 && <p className={styles.hint}>…and {rows.length - 50} more</p>}
        </div>
      </div>
    </div>
  );
}
