-- Ticket #010B: raw sources, ingestion state machine, normalized text.
-- Raw data (sources) and derived data (normalized_content) are deliberately separate:
-- derived data can always be regenerated from the raw source, never the other way round.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid() on PG < 13 safety

CREATE TABLE sources (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL,           -- no FK yet: users table arrives with auth
  original_filename TEXT        NOT NULL,           -- display only, NEVER used to build a path
  mime_type         TEXT        NOT NULL,           -- canonical, derived from extension
  file_size         BIGINT      NOT NULL CHECK (file_size >= 0),
  storage_path      TEXT        NOT NULL,           -- provider-relative key, not an absolute path
  sha256_hash       CHAR(64)    NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Duplicate detection is per user: one user's upload must never reveal another's.
CREATE UNIQUE INDEX sources_user_hash_uniq ON sources (user_id, sha256_hash);
CREATE INDEX sources_user_created_idx ON sources (user_id, created_at DESC);

CREATE TABLE ingestion_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id    UUID        NOT NULL UNIQUE REFERENCES sources(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'RECEIVED'
               CHECK (status IN ('RECEIVED','PROCESSING','PROCESSED','FAILED')),
  attempts     INT         NOT NULL DEFAULT 0,
  error        TEXT,                                  -- why it failed (last attempt)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- The table IS the queue: workers claim with FOR UPDATE SKIP LOCKED.
CREATE INDEX ingestion_jobs_claim_idx ON ingestion_jobs (created_at) WHERE status = 'RECEIVED';

CREATE TABLE normalized_content (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id         UUID        NOT NULL UNIQUE REFERENCES sources(id) ON DELETE CASCADE,
  extracted_text    TEXT        NOT NULL,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  extraction_method TEXT        NOT NULL,             -- versioned, e.g. 'markdown-mdast-v1'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
