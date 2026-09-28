-- NextVault Foundation Schema (Stage 1)
-- Implementation of #010A, #010B, #010C, #010D, #010E

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- 1. Users Table (Foundation for Tenant Isolation)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Source Table (The Birth Certificate)
-- Implements #010B (Source Creation) and #010D (Ownership)
CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    checksum TEXT NOT NULL, -- SHA-256 for deterministic identity
    storage_path TEXT NOT NULL,
    provenance JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Normalized Content Table (The Bridge)
-- Implements #010B and #010F (Memory Engine Boundary)
CREATE TABLE IF NOT EXISTS normalized_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    structure JSONB DEFAULT '{}',
    extraction_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Ingestion Job Table (The State Machine)
-- Implements #010B, #010C (Reliability), and #010E (Observability)
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('RECEIVED', 'VALIDATING', 'STORED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    attempts INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance and Isolation Indexes
CREATE INDEX idx_sources_user_id ON sources(user_id);
CREATE INDEX idx_sources_checksum ON sources(checksum);
CREATE INDEX idx_normalized_source_id ON normalized_content(source_id);
CREATE INDEX idx_jobs_source_id ON ingestion_jobs(source_id);
CREATE INDEX idx_jobs_status ON ingestion_jobs(status);
