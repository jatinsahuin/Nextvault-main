import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { rm, mkdir } from 'node:fs/promises';
import { filesOnDisk, multipart, setup, teardown, type Ctx } from './helpers.js';

let c: Ctx;
beforeAll(async () => { c = await setup(); });
afterAll(async () => { await teardown(c); });
beforeEach(async () => {
  await c.db.query('TRUNCATE sources CASCADE');
  await rm(c.root, { recursive: true, force: true }); // fresh disk too, not just fresh tables
  await mkdir(c.root, { recursive: true });
});

const upload = (name: string, content: Buffer | string, mime?: string, app = c?.app) =>
  app.fastify.inject({ method: 'POST', url: '/sources', ...multipart(name, content, mime) });
const count = async (t: string) => Number((await c.db.query(`SELECT count(*) FROM ${t}`)).rows[0].count);

describe('POST /sources', () => {
  it('stores file, records metadata, and processes to normalized text', async () => {
    const res = await upload('note.md', '# Hello\n\nworld **bold**', 'text/markdown');
    expect(res.statusCode).toBe(201);
    const { source, job } = res.json();
    expect(job.status).toBe('RECEIVED');
    expect(await filesOnDisk(c.root)).toEqual([source.id]);

    await c.app.worker.drain();
    const got = (await c.app.fastify.inject({ method: 'GET', url: `/sources/${source.id}` })).json();
    expect(got.job.status).toBe('PROCESSED');
    expect(got.content.extractedText).toBe('Hello\n\nworld bold');
  });

  it('accepts application/octet-stream (curl default) for .md/.txt', async () => {
    expect((await upload('a.txt', 'plain')).statusCode).toBe(201);
  });

  it('detects duplicates per user and does not store twice', async () => {
    const a = await upload('a.txt', 'same bytes');
    const b = await upload('renamed.txt', 'same bytes');
    expect(b.statusCode).toBe(200);
    expect(b.json().duplicate).toBe(true);
    expect(b.json().source.id).toBe(a.json().source.id);
    expect(await count('sources')).toBe(1);
    expect(await filesOnDisk(c.root)).toHaveLength(1);
  });

  it('does not treat another user\'s identical file as a duplicate, and isolates reads', async () => {
    const a = await upload('a.txt', 'secret');
    const b = await upload('a.txt', 'secret', undefined, c.appB);
    expect(b.json().duplicate).toBe(false);
    expect(b.json().source.id).not.toBe(a.json().source.id);
    const cross = await c.appB.fastify.inject({ method: 'GET', url: `/sources/${a.json().source.id}` });
    expect(cross.statusCode).toBe(404);
  });

  it('handles concurrent identical uploads: one row, one file, no orphans', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => upload('r.txt', 'race condition')));
    expect(results.every((r) => r.statusCode === 200 || r.statusCode === 201)).toBe(true);
    expect(await count('sources')).toBe(1);
    expect(await count('ingestion_jobs')).toBe(1);
    expect(await filesOnDisk(c.root)).toHaveLength(1);
  });

  it.each([
    ['unsupported extension', 'doc.pdf', 'application/pdf', 415],
    ['double extension trick', 'evil.md.exe', 'text/plain', 415],
    ['unsupported mime', 'a.txt', 'image/png', 415],
    ['empty file', 'a.txt', 'text/plain', 422, ''],
    ['binary content', 'a.txt', 'text/plain', 422, Buffer.from([0xff, 0xfe, 0x00])],
  ])('rejects %s', async (_n, name, mime, status, body: Buffer | string = 'x') => {
    const res = await upload(name as string, body, mime as string);
    expect(res.statusCode).toBe(status);
    expect(res.json().error.code).toBeTruthy();
    expect(await count('sources')).toBe(0);
    expect(await filesOnDisk(c.root)).toHaveLength(0);
  });

  it('rejects oversized files with 413 and stores nothing', async () => {
    const res = await upload('big.txt', 'x'.repeat(c.config.maxUploadBytes + 10), 'text/plain');
    expect(res.statusCode).toBe(413);
    expect(await count('sources')).toBe(0);
    expect(await filesOnDisk(c.root)).toHaveLength(0);
  });

  it('rejects non-multipart requests', async () => {
    const res = await c.app.fastify.inject({ method: 'POST', url: '/sources', payload: { a: 1 } });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
  });

  it('neutralises path traversal in filenames', async () => {
    const res = await upload('../../../etc/passwd.md', '# x');
    expect(res.statusCode).toBe(201);
    expect(res.json().source.originalFilename).toBe('passwd.md');
    expect(await filesOnDisk(c.root)).toEqual([res.json().source.id]); // stayed inside storage root
  });

  it('GET with malformed or unknown id returns 404, not 500', async () => {
    expect((await c.app.fastify.inject({ method: 'GET', url: '/sources/not-a-uuid' })).statusCode).toBe(404);
    expect((await c.app.fastify.inject({ method: 'GET', url: '/sources/00000000-0000-4000-8000-0000000000ff' })).statusCode).toBe(404);
  });
});

describe('worker reliability', () => {
  it('fails (no retry) when the stored file no longer matches its hash, writing no content', async () => {
    const { source } = (await upload('a.txt', 'original')).json();
    await c.storage.delete(`${c.config.devUserId}/${source.id}`);
    await c.storage.save(`${c.config.devUserId}/${source.id}`, Buffer.from('tampered'));
    await c.app.worker.drain();
    const job = (await c.db.query('SELECT * FROM ingestion_jobs')).rows[0];
    expect(job.status).toBe('FAILED');
    expect(job.error).toMatch(/hash/);
    expect(job.attempts).toBe(1);
    expect(await count('normalized_content')).toBe(0);
  });

  it('retries transient failures up to the attempt limit, then FAILS', async () => {
    const { source } = (await upload('a.txt', 'gone soon')).json();
    await c.storage.delete(`${c.config.devUserId}/${source.id}`); // read will fail with ENOENT
    await c.app.worker.drain();
    const job = (await c.db.query('SELECT * FROM ingestion_jobs')).rows[0];
    expect(job.status).toBe('FAILED');
    expect(job.attempts).toBe(3);
  });

  it('recovers jobs stuck in PROCESSING after a crash', async () => {
    await upload('a.txt', 'crash test');
    await c.db.query(`UPDATE ingestion_jobs SET status='PROCESSING', attempts=1, started_at=now() - interval '1 hour'`);
    await c.app.worker.start();
    await c.app.worker.stop();
    await c.app.worker.drain();
    expect((await c.db.query('SELECT status FROM ingestion_jobs')).rows[0].status).toBe('PROCESSED');
  });

  it('two concurrent workers never process the same job twice', async () => {
    await Promise.all(Array.from({ length: 6 }, (_, i) => upload(`f${i}.txt`, `content ${i}`)));
    await Promise.all([c.app.worker.drain(), c.appB.worker.drain()]);
    const rows = (await c.db.query('SELECT status, attempts FROM ingestion_jobs')).rows;
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.status === 'PROCESSED' && r.attempts === 1)).toBe(true);
    expect(await count('normalized_content')).toBe(6);
  });
});
