-- 1. Upgrade Index to HNSW for better accuracy and zero-training requirement
DROP INDEX IF EXISTS idx_content_embedding_cos;
CREATE INDEX idx_content_embedding_hnsw ON normalized_content USING hnsw (embedding vector_cosine_ops);

-- 2. Update normalized_content to allow multiple chunks per source
-- We remove the UNIQUE constraint on source_id to support semantic chunking
ALTER TABLE normalized_content DROP CONSTRAINT normalized_content_source_id_key;
