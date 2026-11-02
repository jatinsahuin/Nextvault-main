export interface Entity {
  name: string;
  type: 'Concept' | 'Person' | 'Project' | 'Organization' | 'Location' | 'Other';
  description?: string;
}

export interface Relationship {
  source: string;
  target: string;
  type: string; // e.g., 'RELATES_TO', 'PART_OF', 'AUTHORED', 'CONTRADICTS'
  evidence: string;
}

export interface ExtractionGraph {
  entities: Entity[];
  relationships: Relationship[];
}

export class EntityExtractor {
  constructor(private readonly apiKey: string) {}

  /**
   * Analyzes a piece of text to extract key entities and the relationships between them.
   */
  async extract(text: string): Promise<ExtractionGraph> {
    const systemPrompt = `You are the NextVault Entity Extraction Engine. Your task is to identify key entities and their relationships within the provided text.

ENTITY TYPES:
- Concept: Abstract ideas, theories, or technical terms.
- Person: Individual human beings.
- Project: Named initiatives, research projects, or products.
- Organization: Companies, institutions, or groups.
- Location: Geographic places or specific sites.
- Other: Anything that doesn't fit above but is a distinct entity.

RELATIONSHIP TYPES:
- RELATES_TO: General semantic connection.
- PART_OF: Hierarchical connection (subset/superset).
- AUTHORED: Creation relationship.
- CONTRADICTS: Opposing viewpoints.
- SUPPORTS: Evidence-based connection.

OUTPUT FORMAT:
You must return ONLY a valid JSON object with the following structure:
{
  "entities": [
    { "name": "Entity Name", "type": "Type", "description": "Brief description" }
  ],
  "relationships": [
    { "source": "Entity Name", "target": "Entity Name", "type": "Relation Type", "evidence": "Quote from text" }
  ]
}

If no entities are found, return empty arrays.`;

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
          { role: 'user', content: `EXTRACT ENTITIES AND RELATIONSHIPS FROM THIS TEXT:\n\n${text}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI Entity Extraction Error: ${response.status} ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content) as ExtractionGraph;
  }
}
