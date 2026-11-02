import type { Queryable } from '../db/pool.js';

export const searchRepo = {
  async semanticSearch(db: Queryable, userId: string, queryVector: number[], limit = 5) {
    // We join with sources to ensure tenant isolation (userId)
    const r = await db.query(
      `SELECT c.*, s.original_filename 
       FROM normalized_content c
       JOIN sources s ON c.source_id = s.id
       WHERE s.user_id = $1
       ORDER BY c.embedding <=> $2 
       LIMIT $3`,
      [userId, JSON.stringify(queryVector), limit]
    );
    return r.rows;
  }
};
