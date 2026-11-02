import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';
import type { Db } from '../db/pool.js';
import { searchRepo } from '../ingestion/searchRepo.js';
import { EmbeddingService } from '../services/EmbeddingService.js';
import { SynthesisService } from '../services/SynthesisService.js';
import { getCurrentUserId } from '../auth/currentUser.js';

interface Deps { config: Config; db: Db; embeddingService: EmbeddingService; synthesisService: SynthesisService }

export async function searchRoutes(app: FastifyInstance, { config, db, embeddingService, synthesisService }: Deps) {

  // Existing semantic search endpoint
  app.post<{ Body: { query: string; limit?: number } }>('/search', async (request, reply) => {
    const userId = getCurrentUserId(request, config);
    const { query, limit = 5 } = request.body;

    if (!query) return reply.code(400).send({ error: 'Query is required' });

    try {
      const embedding = await embeddingService.generateEmbedding(query);
      const results = await searchRepo.semanticSearch(db, userId, embedding.vector, limit);

      return {
        query,
        results: results.map(r => ({
          id: r.id,
          filename: r.original_filename,
          text: r.extracted_text,
          metadata: r.metadata,
        }))
      };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Search failed' });
    }
  });

  // NEW: Graph Data Endpoint
  app.get<{ Params: { userId: string } } >('/graph', async (request, reply) => {
    const userId = getCurrentUserId(request, config);

    try {
      const entities = await repo.getEntitiesWithContext(db, userId);
      const relationships = await db.query(
        `SELECT source_entity_id as source, target_entity_id as target, relation_type as type
         FROM relationships WHERE user_id = $1`,
        [userId]
      );

      return {
        nodes: entities.map(e => ({ id: e.id, name: e.name, type: e.type, description: e.description })),
        links: relationships.rows.map(r => ({ source: r.source, target: r.target, type: r.type }))
      };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to load graph' });
    }
  });

  // NEW: Entity Detail Endpoint
  app.get<{ Params: { entityId: string } }>('/entity/:entityId', async (request, reply) => {
    const userId = getCurrentUserId(request, config);
    const { entityId } = request.params;

    try {
      const entityRow = await db.query('SELECT * FROM entities WHERE id = $1 AND user_id = $2', [entityId, userId]);
      const entityData = entityRow.rows[0];

      if (!entityData) return reply.code(404).send({ error: 'Entity not found' });

      const related = await repo.getRelatedEntities(db, userId, entityId);
      const mentions = await repo.getChunksForEntity(db, entityId);

      return {
        entity: entityData,
        related: related,
        mentions: mentions
      };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Detail fetch failed' });
    }
  });

  // NEW: The RAG endpoint for synthesized answers
  app.post<{ Body: { query: string } }>('/ask', async (request, reply) => {
  app.post<{ Body: { query: string } }>('/ask', async (request, reply) => {
    const userId = getCurrentUserId(request, config);
    const { query } = request.body;

    if (!query) return reply.code(400).send({ error: 'Query is required' });

    try {
      // 1. Semantic Retrieval (The "R" in RAG)
      const embedding = await embeddingService.generateEmbedding(query);
      const chunks = await searchRepo.semanticSearch(db, userId, embedding.vector, 5);

      // 2. Graph Expansion (The "G" in GAR)
      // We identify entities in the query and find related knowledge
      const graphExtraction = await entityExtractor.extract(query);
      const expandedContext: any[] = [...chunks];

      for (const entity of graphExtraction.entities) {
        const entityRow = await repo.getEntityByName(db, userId, entity.name);
        if (entityRow) {
          // Find related entities in the graph
          const related = await repo.getRelatedEntities(db, userId, entityRow.id);
          for (const rel of related) {
            // Retrieve chunks specifically tied to these related entities
            const relatedChunks = await repo.getChunksForEntity(db, rel.id);
            expandedContext.push(...relatedChunks);
          }
        }
      }

      // Deduplicate chunks to avoid redundant context
      const uniqueChunks = Array.from(new Map(expandedContext.map(c => [c.id, c])).values()).slice(0, 10);

      if (uniqueChunks.length === 0) {
        return { answer: "Your vault is empty or contains no relevant information to this query.", sources: [] };
      }

      // 3. Synthesis (The "G" in RAG)
      const synthesis = await synthesisService.synthesize({
        query,
        context: uniqueChunks.map(c => ({
          text: c.extracted_text,
          sourceFilename: c.original_filename, // Note: Need to join with sources table if not in content
          chunkIndex: c.metadata?.chunkIndex ?? 0,
        }))
      });

      return {
        answer: synthesis.answer,
        sources: synthesis.sources
      };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Synthesis failed' });
    }
  });
}
