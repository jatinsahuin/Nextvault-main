import type { FastifyInstance } from 'fastify';
import { getCurrentUserId } from '../auth/currentUser.js';
import type { Config } from '../config.js';
import type { Db } from '../db/pool.js';
import { repo } from '../ingestion/repository.js';
import type { IngestionService } from '../ingestion/ingestionService.js';
import type { IngestionWorker } from '../ingestion/worker.js';
import { UploadRejected, validateUploadHeaders } from '../ingestion/uploadValidation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Deps { config: Config; db: Db; ingestion: IngestionService; worker: IngestionWorker }

export async function sourceRoutes(app: FastifyInstance, { config, db, ingestion, worker }: Deps) {
  const present = (s: { id: string; original_filename: string; mime_type: string; file_size: string; sha256_hash: string; created_at: Date }) => ({
    id: s.id, originalFilename: s.original_filename, mimeType: s.mime_type,
    fileSize: Number(s.file_size), sha256: s.sha256_hash, createdAt: s.created_at,
  });
  const presentJob = (j: { id: string; status: string; attempts: number; error: string | null }) =>
    ({ id: j.id, status: j.status, attempts: j.attempts, error: j.error });

  app.post('/sources', async (request, reply) => {
    const userId = getCurrentUserId(request, config);
    const part = await request.file();
    if (!part) throw new UploadRejected('Expected a multipart upload with a file field', 400, 'NO_FILE');

    // Reject on filename/MIME BEFORE reading the body, so bad uploads cost nothing.
    validateUploadHeaders(part.filename, part.mimetype);

    const data = await part.toBuffer(); // throws FST_REQ_FILE_TOO_LARGE past the configured limit
    const result = await ingestion.createSource({ userId, filename: part.filename, clientMime: part.mimetype, data });
    if (!result.duplicate) worker.kick();

    return reply.code(result.duplicate ? 200 : 201).send({
      duplicate: result.duplicate,
      source: present(result.source),
      job: presentJob(result.job),
    });
  });

  app.get<{ Params: { id: string } }>('/sources/:id', async (request, reply) => {
    const userId = getCurrentUserId(request, config);
    const { id } = request.params;
    // Same 404 for "doesn't exist" and "belongs to someone else": never confirm other tenants' ids.
    const source = UUID.test(id) ? await repo.getSource(db, userId, id) : null;
    if (!source) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Source not found' } });

    const [job, content] = await Promise.all([repo.getJobBySource(db, id), repo.getContent(db, id)]);
    return {
      source: present(source),
      job: job ? presentJob(job) : null,
      content: content && {
        extractionMethod: content.extraction_method,
        metadata: content.metadata,
        extractedText: content.extracted_text,
      },
    };
  });
}
