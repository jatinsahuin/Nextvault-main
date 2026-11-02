import { SemanticChunker } from '../services/SemanticChunker.js';
import { EntityExtractor } from '../services/EntityExtractor.js';
import type { Db } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import type { StorageProvider } from '../storage/StorageProvider.js';
import { ExtractorFactory } from './extractors/ExtractorFactory.js';
import { ExtractionError } from './extractors/Extractor.js';
import { repo, type JobRow } from './repository.js';

export interface WorkerOptions { pollMs: number; maxAttempts: number; stuckAfterMs: number }

/**
 * In-process job runner. The ingestion_jobs table is the queue (no Redis, no broker).
 * Uses SKIP LOCKED, so it can later be run as a separate process unchanged.
 */
export class IngestionWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private again = false;
  private stopped = true;
  private current: Promise<void> = Promise.resolve();

  constructor(
    private readonly db: Db,
    private readonly storage: StorageProvider,
    private readonly extractors: ExtractorFactory,
    private readonly embeddingService: any, // Using any for now to avoid complex circular deps in this turn
    private readonly entityExtractor: EntityExtractor,
    private readonly opts: WorkerOptions,
    private readonly log: { error: (o: unknown, m?: string) => void } = console,
  ) {}

  async start(): Promise<void> {
    this.stopped = false;
    await repo.recoverStuckJobs(this.db, this.opts.stuckAfterMs, this.opts.maxAttempts);
    this.timer = setInterval(() => this.kick(), this.opts.pollMs);
    this.kick();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.current;
  }

  /** Wake the worker now (called after an upload) instead of waiting for the next poll. */
  kick(): void {
    if (this.stopped) return;
    if (this.running) { this.again = true; return; }
    this.running = true;
    this.current = this.drain().finally(() => { this.running = false; if (this.again) { this.again = false; this.kick(); } });
  }

  /** Process until the queue is empty. Exposed for tests. */
  async drain(): Promise<void> {
    for (;;) {
      let job: JobRow | null;
      try { job = await repo.claimNextJob(this.db); } catch (e) { this.log.error(e, 'claim failed'); return; }
      if (!job) return;
      await this.process(job);
    }
  }

  private async process(job: JobRow): Promise<void> {
    try {
      const source = await repo.getSourceUnscoped(this.db, job.source_id);
      if (!source) throw new ExtractionError('Source row missing', 'SOURCE_MISSING');

      const raw = await this.storage.read(source.storage_path);
      if (createHash('sha256').update(raw).digest('hex') !== source.sha256_hash) {
        throw new ExtractionError('Stored file does not match its recorded hash', 'INTEGRITY_MISMATCH');
      }
      const result = await this.extractors.forMime(source.mime_type).extract(raw);

      const chunker = new SemanticChunker();
      const chunks = chunker.chunk(result.text);

      // 1. Knowledge Graph Extraction
      // We extract entities and relations from the full text to maintain global context
      const graph = await this.entityExtractor.extract(result.text);

      // Content, Embeddings, Graph, and PROCESSED status commit together or not at all.
      await withTransaction(this.db, async (c) => {
        // A. Clear existing state for idempotency
        await repo.clearContent(c, source.id);

        // B. Store Semantic Chunks
        for (const chunk of chunks) {
          const embedding = await this.embeddingService.generateEmbedding(chunk.text);
          const contentId = await repo.upsertContent(c, source.id, chunk.text, { ...result.metadata, chunkIndex: chunk.index }, result.method, embedding.vector);

          // Link extracted entities to this specific chunk for provenance
          for (const entity of graph.entities) {
            if (chunk.text.toLowerCase().includes(entity.name.toLowerCase())) {
              const entityId = await repo.getOrCreateEntity(c, source.user_id, entity.name, entity.type, entity.description);
              await repo.addEntityMention(c, entityId, contentId, chunk.text.slice(0, 200) + '...');
            }
          }
        }

        // C. Store Global Relationships
        for (const rel of graph.relationships) {
          const sourceId = await repo.getOrCreateEntity(c, source.user_id, rel.source, 'Concept'); // Default to Concept if not found
          const targetId = await repo.getOrCreateEntity(c, source.user_id, rel.target, 'Concept');
          await repo.createRelationship(c, source.user_id, sourceId, targetId, rel.type);
        }

        await repo.markProcessed(c, job.id);
      });
    } catch (err) {
      const terminal = err instanceof ExtractionError;
      this.log.error({ jobId: job.id, err }, 'ingestion job failed');
      await repo.markFailed(this.db, job.id, (err as Error).message, !terminal, this.opts.maxAttempts)
        .catch((e) => this.log.error(e, 'could not record job failure'));
    }
  }
}
