import { EmbeddingProvider, Embedding } from '../providers/ai/EmbeddingProvider.js';

export class EmbeddingService {
  constructor(private readonly provider: EmbeddingProvider) {}

  /**
   * Transforms a piece of text into a semantic vector.
   */
  async generateEmbedding(text: string): Promise<Embedding> {
    // In a production system, we would handle truncation/chunking here
    // if the text exceeds the provider's token limit.
    return this.provider.embed(text);
  }

  getDimensions(): number {
    return this.provider.getDimensions();
  }
}
