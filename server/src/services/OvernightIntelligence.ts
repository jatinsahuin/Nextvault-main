export interface DiscoveryInsight {
  sourceEntity: string;
  targetEntity: string;
  relationType: string;
  reasoning: string;
  confidence: number;
}

export class OvernightIntelligence {
  constructor(private readonly apiKey: string) {}

  /**
   * Analyzes a set of entities and their contexts to discover hidden relationships.
   */
  async discoverRelationships(entities: Array<{ name: string; description: string; mentions: string[] }>): Promise<DiscoveryInsight[]> {
    if (entities.length < 2) return [];

    const entityContext = entities.map(e => `Entity: ${e.name}\nDescription: ${e.description}\nKey Mentions: ${e.mentions.slice(0, 3).join(' | ')}`).join('\n\n---\n\n');

    const systemPrompt = `You are the NextVault Overnight Intelligence Engine. Your task is to discover non-obvious, high-value relationships between entities in a user's knowledge base.

GOAL:
Identify semantic connections that the user may not have explicitly noticed. Look for conceptual bridges, contradictions, or evolutionary links.

OUTPUT FORMAT:
You must return ONLY a valid JSON object with the following structure:
{
  "discoveries": [
    {
      "source": "Entity Name",
      "target": "Entity Name",
      "type": "RELATIONSHIP_TYPE",
      "reasoning": "Detailed explanation of why these are connected",
      "confidence": 0.0 to 1.0
    }
  ]
}

RELATIONSHIP TYPES:
- SEMANTIC_BRIDGE: Two different concepts that share a common underlying principle.
- HIDDEN_CONFLICT: Two pieces of knowledge that seem to contradict each other.
- EVOLUTIONARY_LINK: An idea that seems to be a precursor or successor to another.
- UNEXPECTED_SYNERGY: Two separate projects or ideas that could be combined for a new result.`;

    const userPrompt = `SENSING KNOWLEDGE SPACE:\n\n${entityContext}\n\nTASK: Discover the most significant hidden relationships.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Slightly higher temperature for "discovery"
      }),
    });

    if (!response.ok) {
      throw new Error(`Overnight Intelligence API Error: ${response.status}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content).discoveries;
  }
}
