export interface Embedding {
  vector: number[];
  model: string;
  dimensions: number;
}

export interface EmbeddingProvider {
  /**
   * Generates a vector embedding for the given text.
   */
  embed(text: string): Promise<Embedding>;

  /**
   * Returns the expected dimensionality of the embeddings produced by this provider.
   */
  getDimensions(): number;
}
