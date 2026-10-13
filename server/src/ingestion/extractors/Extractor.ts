export interface ExtractionResult {
  text: string;
  metadata: Record<string, unknown>;
  /** Versioned so we can later find and reprocess everything produced by an old extractor. */
  method: string;
}

export interface Extractor {
  extract(raw: Buffer): Promise<ExtractionResult>;
}

/** Deterministic failure: retrying the same bytes will not help. */
export class ExtractionError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'ExtractionError';
  }
}
