-- QRTrack schema. Idempotent: applied automatically on every server start.

CREATE TABLE IF NOT EXISTS qr_codes (
  id               TEXT PRIMARY KEY,
  destination_type TEXT NOT NULL DEFAULT 'url',
  destination_url  TEXT,
  text_content     TEXT,
  label            TEXT,
  style            JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_scans      INTEGER NOT NULL DEFAULT 0,
  unique_scans     INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qr_codes_destination_check CHECK (
    (destination_type = 'url' AND destination_url IS NOT NULL AND text_content IS NULL)
    OR
    (destination_type = 'text' AND text_content IS NOT NULL AND destination_url IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS scans (
  id           BIGSERIAL PRIMARY KEY,
  qr_id        TEXT NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  fingerprint  TEXT NOT NULL,
  is_unique    BOOLEAN NOT NULL DEFAULT FALSE,
  device       TEXT,
  browser      TEXT,
  os           TEXT,
  scanned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scans_qr_time ON scans (qr_id, scanned_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scans_unique_fingerprint
  ON scans (qr_id, fingerprint) WHERE is_unique;
CREATE INDEX IF NOT EXISTS idx_qr_created ON qr_codes (created_at DESC);

-- Logs one scan and bumps the counters atomically. Returns TRUE for a first-time
-- visitor (the fingerprint rotates daily, so "unique" means unique per day).
CREATE OR REPLACE FUNCTION record_qr_scan(
  p_qr_id TEXT,
  p_fingerprint TEXT,
  p_device TEXT,
  p_browser TEXT,
  p_os TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_new INTEGER := 0;
BEGIN
  INSERT INTO scans (qr_id, fingerprint, is_unique, device, browser, os)
  VALUES (p_qr_id, p_fingerprint, TRUE, p_device, p_browser, p_os)
  ON CONFLICT (qr_id, fingerprint) WHERE is_unique DO NOTHING;

  GET DIAGNOSTICS v_new = ROW_COUNT;

  IF v_new = 0 THEN
    INSERT INTO scans (qr_id, fingerprint, is_unique, device, browser, os)
    VALUES (p_qr_id, p_fingerprint, FALSE, p_device, p_browser, p_os);
  END IF;

  UPDATE qr_codes
  SET total_scans = total_scans + 1,
      unique_scans = unique_scans + v_new
  WHERE id = p_qr_id;

  RETURN v_new = 1;
END;
$$;
