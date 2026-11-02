import { Embedding, EmbeddingProvider } from './EmbeddingProvider.js';

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private readonly model = 'text-embedding-3-small';
  private readonly dimensions = 1536;

  constructor(private readonly apiKey: string) {}

  async embed(text: string): Promise<Embedding> {
    if (!this.apiKey) {
      throw new Error('OpenAI API Key is not configured');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: this.model,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API Error: ${response.status} ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return {
      vector: data.data[0].embedding,
      model: this.model,
      dimensions: this.dimensions,
    };
  }

  getDimensions(): number {
    return this.dimensions;
  }
}
