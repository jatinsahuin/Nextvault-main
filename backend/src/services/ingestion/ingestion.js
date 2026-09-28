import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { LocalStorageProvider } from '../providers/storage/storage.js';
import { ExtractorFactory } from './extractor.js';

const { Pool } = pg;
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'nextvault',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
});

const storage = new LocalStorageProvider();

export async function createSource(userId, file, metadata = {}) {
    const fileBuffer = await file.toBuffer();
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const sourceId = uuidv4();

    const storagePath = await storage.save(userId, sourceId, fileBuffer);

    await pool.query(
        `INSERT INTO sources (id, user_id, original_filename, mime_type, file_size, checksum, storage_path, provenance)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [sourceId, userId, file.filename, file.mimetype, file.filesize, checksum, storagePath, metadata]
    );

    await pool.query(
        `INSERT INTO ingestion_jobs (source_id, status) VALUES ($1, 'RECEIVED')`,
        [sourceId]
    );

    return { sourceId, status: 'RECEIVED' };
}

export async function getSourceStatus(sourceId, userId) {
    const res = await pool.query(
        `SELECT j.status FROM ingestion_jobs j
         JOIN sources s ON j.source_id = s.id
         WHERE s.id = $1 AND s.user_id = $2`,
        [sourceId, userId]
    );
    if (res.rows.length === 0) throw new Error('Source not found');
    return res.rows[0].status;
}

export async function processIngestion(sourceId) {
    try {
        await pool.query(`UPDATE ingestion_jobs SET status = 'VALIDATING', started_at = NOW() WHERE source_id = $1`, [sourceId]);
        const sourceRes = await pool.query(`SELECT * FROM sources WHERE id = $1`, [sourceId]);
        const source = sourceRes.rows[0];

        await pool.query(`UPDATE ingestion_jobs SET status = 'EXTRACTING' WHERE source_id = $1`, [sourceId]);

        const fileBuffer = await storage.get(source.storage_path);
        const extractor = ExtractorFactory.getExtractor(source.mime_type);
        const normalized = await extractor.extract(fileBuffer);

        await pool.query(
            `INSERT INTO normalized_content (source_id, content, language, structure) VALUES ($1, $2, $3, $4)`,
            [sourceId, normalized.content, normalized.language, normalized.structure]
        );

        await pool.query(`UPDATE ingestion_jobs SET status = 'COMPLETED', completed_at = NOW() WHERE source_id = $1`, [sourceId]);
    } catch (err) {
        await pool.query(`UPDATE ingestion_jobs SET status = 'FAILED', error_message = $1 WHERE source_id = $2`, [err.message, sourceId]);
    }
}
