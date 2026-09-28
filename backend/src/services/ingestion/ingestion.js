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

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function createSource(userId, file, metadata = {}) {
    // 1. Security Validation (#010D)
    if (file.filesize > MAX_FILE_SIZE) {
        throw new Error('File size exceeds maximum limit of 50MB');
    }

    const fileBuffer = await file.toBuffer();

    // Content Integrity & Duplicate Detection (#010B)
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Check for duplicates
    const duplicateCheck = await pool.query(
        'SELECT id FROM sources WHERE checksum = $1 AND user_id = $2 LIMIT 1',
        [checksum, userId]
    );

    if (duplicateCheck.rows.length > 0) {
        return {
            sourceId: duplicateCheck.rows[0].id,
            status: 'RECEIVED',
            isDuplicate: true
        };
    }

    const sourceId = uuidv4();

    // 2. Persistent Storage (#010B)
    const storagePath = await storage.save(userId, sourceId, fileBuffer);

    // 3. Database Record (Provenance & Ownership) (#010D)
    await pool.query(
        `INSERT INTO sources (id, user_id, original_filename, mime_type, file_size, checksum, storage_path, provenance)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [sourceId, userId, file.filename, file.mimetype, file.filesize, checksum, storagePath, metadata]
    );

    // 4. Ingestion Job Entry (The State Machine) (#010B, #010C)
    await pool.query(
        `INSERT INTO ingestion_jobs (source_id, status) VALUES ($1, 'RECEIVED')`,
        [sourceId]
    );

    return { sourceId, status: 'RECEIVED', isDuplicate: false };
}

export async function getSourceStatus(sourceId, userId) {
    // Tenant Isolation (#010D)
    const res = await pool.query(
        `SELECT j.status FROM ingestion_jobs j
         JOIN sources s ON j.source_id = s.id
         WHERE s.id = $1 AND s.user_id = $2`,
        [sourceId, userId]
    );
    if (res.rows.length === 0) throw new Error('Source not found or access denied');
    return res.rows[0].status;
}

export async function processIngestion(sourceId) {
    let currentStatus = 'RECEIVED';
    try {
        // Step 1: Validating (#010B)
        await updateJobStatus(sourceId, 'VALIDATING');

        const sourceRes = await pool.query(`SELECT * FROM sources WHERE id = $1`, [sourceId]);
        const source = sourceRes.rows[0];

        // Step 2: Extracting (#010B)
        await updateJobStatus(sourceId, 'EXTRACTING');

        const fileBuffer = await storage.get(source.storage_path);
        const extractor = ExtractorFactory.getExtractor(source.mime_type);
        const normalized = await extractor.extract(fileBuffer);

        // Step 3: Persist Normalized Content (#010B, #010F)
        await pool.query(
            `INSERT INTO normalized_content (source_id, content, language, structure) VALUES ($1, $2, $3, $4)`,
            [sourceId, normalized.content, normalized.language, normalized.structure]
        );

        // Step 4: Finalize (#010B)
        await updateJobStatus(sourceId, 'COMPLETED');

    } catch (err) {
        console.error(`Ingestion failure for ${sourceId}:`, err);
        await updateJobStatus(sourceId, 'FAILED', err.message);
    }
}

async function updateJobStatus(sourceId, status, errorMessage = null) {
    await pool.query(
        `UPDATE ingestion_jobs
         SET status = $1,
             error_message = $2,
             started_at = CASE WHEN $1 = 'VALIDATING' THEN NOW() ELSE started_at END,
             completed_at = CASE WHEN $1 = 'COMPLETED' THEN NOW() ELSE completed_at END
         WHERE source_id = $3`,
        [status, errorMessage, sourceId]
    );
}

export { pool };
