import { createHash, randomUUID } from 'node:crypto';
import type { Db } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import type { StorageProvider } from '../storage/StorageProvider.js';
import { repo, type JobRow, type SourceRow } from './repository.js';
import { sanitizeFilename, UploadRejected, validateUploadHeaders } from './uploadValidation.js';
import { decodeUtf8 } from './extractors/normalize.js';
import { ExtractionError } from './extractors/Extractor.js';

export interface CreateSourceInput {
  userId: string;
  filename: string;
  clientMime: string;
  data: Buffer;
}
export interface CreateSourceResult { source: SourceRow; job: JobRow; duplicate: boolean }

export class IngestionService {
  constructor(private readonly db: Db, private readonly storage: StorageProvider) {}

  async createSource(input: CreateSourceInput): Promise<CreateSourceResult> {
    const { mime } = validateUploadHeaders(input.filename, input.clientMime);
    if (input.data.length === 0) throw new UploadRejected('File is empty', 422, 'EMPTY_FILE');
    try { decodeUtf8(input.data); } catch (e) {
      if (e instanceof ExtractionError) throw new UploadRejected(e.message, 422, e.code);
      throw e;
    }

    const sha256 = createHash('sha256').update(input.data).digest('hex');

    const existing = await repo.findSourceByHash(this.db, input.userId, sha256);
    if (existing) return this.asDuplicate(existing);

    const id = randomUUID();
    const key = `${input.userId}/${id}`; // generated, never derived from the filename
    await this.storage.save(key, input.data);
    try {
      return await withTransaction(this.db, async (c) => {
        const source = await repo.insertSource(c, {
          id, user_id: input.userId, original_filename: sanitizeFilename(input.filename),
          mime_type: mime, file_size: String(input.data.length), storage_path: key, sha256_hash: sha256,
        });
        const job = await repo.insertJob(c, id);
        return { source, job, duplicate: false };
      });
    } catch (err) {
      await this.storage.delete(key).catch(() => undefined); // compensate: no orphan file
      if ((err as { code?: string }).code === '23505') { // lost a race with an identical upload
        const winner = await repo.findSourceByHash(this.db, input.userId, sha256);
        if (winner) return this.asDuplicate(winner);
      }
      throw err;
    }
  }

  private async asDuplicate(source: SourceRow): Promise<CreateSourceResult> {
    const job = await repo.getJobBySource(this.db, source.id);
    return { source, job: job!, duplicate: true };
  }
}
