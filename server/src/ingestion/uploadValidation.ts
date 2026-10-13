import path from 'node:path';
import { SUPPORTED_TYPES } from './extractors/ExtractorFactory.js';

/**
 * Client-supplied MIME types are unreliable (curl and many browsers send
 * application/octet-stream for .md). So: the EXTENSION decides the type, and the MIME
 * header is only checked for being not-obviously-wrong. Content is validated for real
 * (UTF-8, no NULs) by the extractor's decoder at upload time.
 */
const ACCEPTED_CLIENT_MIMES = new Set(['text/plain', 'text/markdown', 'text/x-markdown', 'application/octet-stream']);

export class UploadRejected extends Error {
  constructor(message: string, readonly statusCode: number, readonly code: string) {
    super(message);
  }
}

export function validateUploadHeaders(filename: string, clientMime: string) {
  const ext = path.extname(filename).toLowerCase();
  const type = SUPPORTED_TYPES[ext];
  if (!type) throw new UploadRejected('Only .txt and .md files are supported', 415, 'UNSUPPORTED_FILE_TYPE');
  const mime = clientMime.split(';')[0]!.trim().toLowerCase();
  if (!ACCEPTED_CLIENT_MIMES.has(mime)) throw new UploadRejected(`Unsupported MIME type: ${mime}`, 415, 'UNSUPPORTED_MIME_TYPE');
  return { ext, mime: type.mime };
}

/** Display-only. Strips path components and control chars; never used to build a storage path. */
export function sanitizeFilename(name: string): string {
  // eslint-disable-next-line no-control-regex
  const base = path.basename(name.replace(/\\/g, '/')).replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return (base || 'untitled').slice(0, 255);
}
