export interface Chunk {
  text: string;
  index: number;
  metadata: Record<string, unknown>;
}

export class SemanticChunker {
  constructor(
    private readonly chunkSize: number = 1000,
    private readonly chunkOverlap: number = 200
  ) {}

  /**
   * Splits text into overlapping chunks to preserve context across boundaries.
   */
  chunk(text: string): Chunk[] {
    const chunks: Chunk[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length);
      chunks.push({
        text: text.slice(start, end),
        index: chunks.length,
        metadata: {}
      });

      if (end === text.length) break;
      start += (this.chunkSize - this.chunkOverlap);
    }

    return chunks;
  }
}
