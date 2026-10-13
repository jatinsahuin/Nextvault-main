import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildApp, type App } from '../src/app.js';
import type { Config } from '../src/config.js';
import { createPool, type Db } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { LocalStorageProvider } from '../src/storage/LocalStorageProvider.js';

export const USER_A = '00000000-0000-4000-8000-00000000000a';
export const USER_B = '00000000-0000-4000-8000-00000000000b';

export interface Ctx { db: Db; app: App; appB: App; root: string; config: Config; storage: LocalStorageProvider }

export async function setup(overrides: Partial<Config> = {}): Promise<Ctx> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nv-'));
  const config: Config = {
    databaseUrl: process.env.TEST_DATABASE_URL ?? 'postgres://nextvault:nextvault@localhost:5432/nextvault_test',
    storageRoot: root, port: 0, maxUploadBytes: 1024, devUserId: USER_A, nodeEnv: 'test',
    maxJobAttempts: 3, jobStuckAfterMs: 1000, workerPollMs: 60_000, ...overrides,
  };
  const db = createPool(config.databaseUrl);
  await migrate(db);
  await db.query('TRUNCATE sources CASCADE');
  const storage = new LocalStorageProvider(root);
  const app = await buildApp(config, db, storage);
  const appB = await buildApp({ ...config, devUserId: USER_B }, db, storage);
  return { db, app, appB, root, config, storage };
}

export async function teardown(c: Ctx) {
  await c.app.fastify.close(); await c.appB.fastify.close(); await c.db.end();
  await rm(c.root, { recursive: true, force: true });
}

export async function filesOnDisk(root: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(root, { recursive: true, withFileTypes: true })) if (e.isFile()) out.push(e.name);
  return out;
}

export function multipart(filename: string, content: Buffer | string, mime = 'application/octet-stream') {
  const boundary = '----nvtest' + Math.random().toString(16).slice(2);
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`),
    Buffer.isBuffer(content) ? content : Buffer.from(content),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload: body, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}
