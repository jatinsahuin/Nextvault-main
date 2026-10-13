import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import type { Config } from './config.js';
import type { Db } from './db/pool.js';
import type { StorageProvider } from './storage/StorageProvider.js';
import { IngestionService } from './ingestion/ingestionService.js';
import { IngestionWorker } from './ingestion/worker.js';
import { ExtractorFactory } from './ingestion/extractors/ExtractorFactory.js';
import { UploadRejected } from './ingestion/uploadValidation.js';
import { sourceRoutes } from './routes/sources.js';

export interface App { fastify: FastifyInstance; worker: IngestionWorker }

/** Composition root: the only place concrete dependencies are wired together. */
export async function buildApp(config: Config, db: Db, storage: StorageProvider, opts: { logger?: boolean } = {}): Promise<App> {
  const fastify = Fastify({ logger: opts.logger ?? false, bodyLimit: config.maxUploadBytes + 64 * 1024 });

  await fastify.register(multipart, {
    limits: { fileSize: config.maxUploadBytes, files: 1, fields: 5, parts: 6 },
  });

  const worker = new IngestionWorker(db, storage, new ExtractorFactory(), {
    pollMs: config.workerPollMs, maxAttempts: config.maxJobAttempts, stuckAfterMs: config.jobStuckAfterMs,
  }, fastify.log);
  const ingestion = new IngestionService(db, storage);

  fastify.setErrorHandler((err: Error & { code?: string; statusCode?: number }, request, reply) => {
    if (err instanceof UploadRejected) {
      return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message } });
    }
    if (err.code === 'FST_REQ_FILE_TOO_LARGE' || err.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.code(413).send({ error: { code: 'FILE_TOO_LARGE', message: `File exceeds ${config.maxUploadBytes} bytes` } });
    }
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: { code: err.code ?? 'BAD_REQUEST', message: err.message } });
    }
    request.log.error(err);
    return reply.code(500).send({ error: { code: 'INTERNAL', message: 'Internal server error' } }); // no internals leaked
  });

  fastify.get('/health', async (_req, reply) => {
    try { await db.query('SELECT 1'); return { status: 'ok' }; }
    catch { return reply.code(503).send({ status: 'database_unavailable' }); }
  });

  await fastify.register(sourceRoutes, { config, db, ingestion, worker });
  fastify.addHook('onClose', async () => { await worker.stop(); });
  return { fastify, worker };
}
