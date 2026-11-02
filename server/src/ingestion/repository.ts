import type { Queryable } from '../db/pool.js';

export type JobStatus = 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

export interface SourceRow {
  id: string; user_id: string; original_filename: string; mime_type: string;
  file_size: string; storage_path: string; sha256_hash: string; created_at: Date;
}
export interface JobRow {
  id: string; source_id: string; status: JobStatus; attempts: number; error: string | null;
  created_at: Date; started_at: Date | null; completed_at: Date | null;
}
export interface ContentRow {
  id: string; source_id: string; extracted_text: string;
  metadata: Record<string, unknown>; extraction_method: string; created_at: Date;
}

/** All SQL for the ingestion tables lives here. Nothing else writes these queries. */
export const repo = {
  async findSourceByHash(db: Queryable, userId: string, sha256: string) {
    const r = await db.query<SourceRow>('SELECT * FROM sources WHERE user_id=$1 AND sha256_hash=$2', [userId, sha256]);
    return r.rows[0] ?? null;
  },

  async getSource(db: Queryable, userId: string, id: string) {
    const r = await db.query<SourceRow>('SELECT * FROM sources WHERE id=$1 AND user_id=$2', [id, userId]);
    return r.rows[0] ?? null;
  },

  async getSourceUnscoped(db: Queryable, id: string) { // worker only: it acts for the system, not a user
    const r = await db.query<SourceRow>('SELECT * FROM sources WHERE id=$1', [id]);
    return r.rows[0] ?? null;
  },

  async insertSource(db: Queryable, s: Omit<SourceRow, 'created_at'>) {
    const r = await db.query<SourceRow>(
      `INSERT INTO sources (id,user_id,original_filename,mime_type,file_size,storage_path,sha256_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [s.id, s.user_id, s.original_filename, s.mime_type, s.file_size, s.storage_path, s.sha256_hash],
    );
    return r.rows[0]!;
  },

  async insertJob(db: Queryable, sourceId: string) {
    const r = await db.query<JobRow>('INSERT INTO ingestion_jobs (source_id) VALUES ($1) RETURNING *', [sourceId]);
    return r.rows[0]!;
  },

  async getJobBySource(db: Queryable, sourceId: string) {
    const r = await db.query<JobRow>('SELECT * FROM ingestion_jobs WHERE source_id=$1', [sourceId]);
    return r.rows[0] ?? null;
  },

  async getContent(db: Queryable, sourceId: string) {
    const r = await db.query<ContentRow>('SELECT * FROM normalized_content WHERE source_id=$1', [sourceId]);
    return r.rows[0] ?? null;
  },

  async clearContent(db: Queryable, sourceId: string) {
    await db.query('DELETE FROM normalized_content WHERE source_id = $1', [sourceId]);
  },

  /** Atomically claim one job. SKIP LOCKED makes this safe with any number of workers. */
  async claimNextJob(db: Queryable) {
    const r = await db.query<JobRow>(
      `UPDATE ingestion_jobs SET status='PROCESSING', attempts=attempts+1, started_at=now(), error=NULL
       WHERE id = (SELECT id FROM ingestion_jobs WHERE status='RECEIVED'
                   ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
       RETURNING *`,
    );
    return r.rows[0] ?? null;
  },

  /**
   * Store content chunks.
   * We allow multiple chunks per source to support semantic chunking.
   */
  async upsertContent(db: Queryable, sourceId: string, text: string, metadata: object, method: string, embedding?: number[]) {
    const embeddingValue = embedding ? `\${JSON.stringify(embedding)}` : 'NULL';
    const r = await db.query(
      \`INSERT INTO normalized_content (source_id, extracted_text, metadata, extraction_method, embedding)
       VALUES (\$1,\$2,\$3,\$4, \${embeddingValue}) RETURNING id\`,
      [sourceId, text, JSON.stringify(metadata), method],
    );
    return r.rows[0].id;
  },

  async getOrCreateEntity(db: Queryable, userId: string, name: string, type: string, description?: string) {
    const res = await db.query(
      `INSERT INTO entities (user_id, name, type, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, name, type) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [userId, name, type, description]
    );
    return res.rows[0].id;
  },

  async createRelationship(db: Queryable, userId: string, sourceId: string, targetId: string, type: string) {
    await db.query(
      `INSERT INTO relationships (user_id, source_entity_id, target_entity_id, relation_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [userId, sourceId, targetId, type]
    );
  },

  async addEntityMention(db: Queryable, entityId: string, contentId: string, snippet: string) {
    await db.query(
      `INSERT INTO entity_mentions (entity_id, content_id, context_snippet)
       VALUES ($1, $2, $3)`,
      [entityId, contentId, snippet]
    );
  },

  async getEntityByName(db: Queryable, userId: string, name: string) {
    const r = await db.query(
      `SELECT * FROM entities WHERE user_id = $1 AND name = $2`,
      [userId, name]
    );
    return r.rows[0] ?? null;
  },

  async getRelatedEntities(db: Queryable, userId: string, entityId: string) {
    const r = await db.query(
      `SELECT e.name, e.id
       FROM relationships rel
       JOIN entities e ON rel.target_entity_id = e.id
       WHERE rel.source_entity_id = $1 AND rel.user_id = $2`,
      [entityId, userId]
    );
    return r.rows;
  },

  async getChunksForEntity(db: Queryable, entityId: string) {
    const r = await db.query(
      `SELECT c.*
       FROM entity_mentions m
       JOIN normalized_content c ON m.content_id = c.id
       WHERE m.entity_id = $1`,
      [entityId]
    );
    return r.rows;
  },

  async markProcessed(db: Queryable, jobId: string) {
    await db.query(`UPDATE ingestion_jobs SET status='PROCESSED', completed_at=now(), error=NULL WHERE id=$1`, [jobId]);
  },

  /** Retryable failure goes back to RECEIVED; terminal failure (or attempts exhausted) goes to FAILED. */
  async markFailed(db: Queryable, jobId: string, error: string, retryable: boolean, maxAttempts: number) {
    await db.query(
      `UPDATE ingestion_jobs
         SET status = CASE WHEN $3 AND attempts < $4 THEN 'RECEIVED' ELSE 'FAILED' END,
             error = $2,
             completed_at = CASE WHEN $3 AND attempts < $4 THEN NULL ELSE now() END
       WHERE id=$1`,
      [jobId, error.slice(0, 1000), retryable, maxAttempts],
    );
  },

  /** Crash recovery: jobs stuck in PROCESSING (worker died) are retried or failed. */
  async recoverStuckJobs(db: Queryable, stuckAfterMs: number, maxAttempts: number) {
    const r = await db.query(
      `UPDATE ingestion_jobs
         SET status = CASE WHEN attempts < $2 THEN 'RECEIVED' ELSE 'FAILED' END,
             error = 'Worker stopped while processing',
             completed_at = CASE WHEN attempts < $2 THEN NULL ELSE now() END
       WHERE status='PROCESSING' AND started_at < now() - ($1 || ' milliseconds')::interval`,
      [String(stuckAfterMs), maxAttempts],
    );
    return r.rowCount ?? 0;
  },
};
