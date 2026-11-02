import type { Db } from '../db/pool.js';
import { OvernightIntelligence } from './OvernightIntelligence.js';
import { repo } from '../ingestion/repository.js';

export class OvernightWorker {
  constructor(
    private readonly db: Db,
    private readonly intelligence: OvernightIntelligence,
    private readonly pollMs: number = 1000 * 60 * 60 // Default: once per hour
  ) {}

  async start() {
    console.log('🌙 Overnight Intelligence Worker started...');
    this.timer = setInterval(() => this.runDiscovery(), this.pollMs);
    this.runDiscovery();
  }

  private timer: NodeJS.Timeout;

  async stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async runDiscovery() {
    console.log('🌙 Running overnight discovery cycle...');
    try {
      // We iterate through users (simplified for MVP)
      const users = await this.db.query('SELECT id FROM users');
      
      for (const user of users.rows) {
        const entities = await repo.getEntitiesWithContext(this.db, user.id);
        if (entities.length < 2) continue;

        const discoveries = await this.intelligence.discoverRelationships(entities);

        for (const disc of discoveries) {
          const source = await repo.getEntityByName(this.db, user.id, disc.source);
          const target = await repo.getEntityByName(this.db, user.id, disc.target);

          if (source && target) {
            await repo.saveInsight(this.db, {
              userId: user.id,
              sourceId: source.id,
              targetId: target.id,
              type: disc.relationType,
              reasoning: disc.reasoning,
              confidence: disc.confidence
            });
            
            // Also create a real relationship in the graph if confidence is high
            if (disc.confidence > 0.8) {
              await repo.createRelationship(this.db, user.id, source.id, target.id, disc.relationType);
            }
          }
        }
      }
      console.log('🌙 Discovery cycle completed.');
    } catch (err) {
      console.error('🌙 Overnight Intelligence Error:', err);
    }
  }
}
