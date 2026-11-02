-- Ticket #010G: Semantic Vector Indexing
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to normalized_content
-- 1536 is the dimension for OpenAI text-embedding-3-small
ALTER TABLE normalized_content ADD COLUMN embedding vector(1536);

-- Index for cosine similarity (IVFFlat is good for MVP, HNSW for production)
CREATE INDEX idx_content_embedding_cos ON normalized_content USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
