import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';
import type { Db } from '../db/pool.js';
import { searchRepo } from '../ingestion/searchRepo.js';
import { EmbeddingService } from '../services/EmbeddingService.js';
import { getCurrentUserId } from '../auth/currentUser.js';

interface Deps { config: Config; db: Db; embeddingService: EmbeddingService }

export async function searchRoutes(app: FastifyInstance, { config, db, embeddingService }: Deps) {
  app.post<{ Body: { query: string; limit?: number } }>('/search', async (request, reply) => {
    const userId = getCurrentUserId(request, config);
    const { query, limit = 5 } = request.body;

    if (!query) return reply.code(400).send({ error: 'Query is required' });

    try {
      // 1. Transform query to vector
      const embedding = await embeddingService.generateEmbedding(query);

      // 2. Semantic search in DB
      const results = await searchRepo.semanticSearch(db, userId, embedding.vector, limit);

      return {
        query,
        results: results.map(r => ({
          id: r.id,
          filename: r.original_filename,
          text: r.extracted_text,
          metadata: r.metadata,
          // Distance is usually returned by the DB if we use the operator in SELECT,
          // but we can add that later for ranking.
        }))
      };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Search failed' });
    }
  });
}
