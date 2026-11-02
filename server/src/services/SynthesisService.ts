export interface SynthesisRequest {
  query: string;
  context: Array<{
    text: string;
    sourceFilename: string;
    chunkIndex: number;
  }>;
}

export interface SynthesisResponse {
  answer: string;
  sources: Array<{
    sourceFilename: string;
    chunkIndex: number;
  }>;
}

export class SynthesisService {
  constructor(private readonly apiKey: string) {}

  /**
   * Synthesizes an answer based strictly on the provided context.
   */
  async synthesize(request: SynthesisRequest): Promise<SynthesisResponse> {
    const contextText = request.context
      .map((c, i) => `[Source ${i+1}: ${c.sourceFilename}, Chunk ${c.chunkIndex}]\n${c.text}`)
      .join('\n\n');

    const systemPrompt = `You are the NextVault Intelligence Layer. Your goal is to synthesize a precise answer based ONLY on the provided context.

RULES:
1. Use ONLY the provided context. Do not use outside knowledge.
2. If the answer is not contained within the context, state clearly: "I cannot find this information in your vault."
3. Maintain a professional, technical, and calm tone.
4. When referencing information, use the source markers (e.g., [Source 1]).
5. Be concise and direct.`;

    const userPrompt = `CONTEXT:\n${contextText}\n\nUSER QUERY: ${request.query}\n\nSYNTHESIS:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Using a high-reasoning model for synthesis
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0, // Zero temperature for maximum factual precision
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI Synthesis Error: ${response.status} ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const answer = data.choices[0].message.content;

    // Extract which sources were actually used in the answer
    const usedSources = request.context.filter((c, i) =>
      answer.includes(`[Source ${i+1}]`)
    ).map(c => ({
      sourceFilename: c.sourceFilename,
      chunkIndex: c.chunkIndex
    }));

    return {
      answer,
      sources: usedSources,
    };
  }
}
