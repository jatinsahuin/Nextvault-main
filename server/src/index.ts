import { loadConfig } from './config.js';
import { assertAuthConfigured } from './auth/currentUser.js';
import { createPool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { LocalStorageProvider } from './storage/LocalStorageProvider.js';
import { buildApp } from './app.js';

const config = loadConfig();
assertAuthConfigured(config);

const db = createPool(config.databaseUrl);
await migrate(db);

const { fastify, worker } = await buildApp(config, db, new LocalStorageProvider(config.storageRoot), { logger: true });
await worker.start();
await fastify.listen({ port: config.port, host: '127.0.0.1' }); // loopback only until auth exists

const shutdown = async () => { await fastify.close(); await db.end(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
