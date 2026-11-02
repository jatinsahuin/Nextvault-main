-- Ticket #010I: Living Knowledge Graph Foundation

-- 1. Entities Table (The Nodes)
-- Represents a unique 'Thing' in the user's knowledge base.
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- e.g., 'Concept', 'Person', 'Project', 'Organization'
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, name, type)
);

-- 2. Relationships Table (The Edges)
-- Represents the connection between two entities.
CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL, -- e.g., 'RELATES_TO', 'PART_OF', 'AUTHORED', 'CONTRADICTS'
    strength FLOAT DEFAULT 1.0, -- For future weighted graphs
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(source_entity_id, target_entity_id, relation_type)
);

-- 3. Entity Mentions (The Provenance Bridge)
-- Connects an entity to the specific chunk of text where it was found.
CREATE TABLE entity_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES normalized_content(id) ON DELETE CASCADE,
    context_snippet TEXT, -- The surrounding text for quick reference
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX idx_entities_user_type ON entities(user_id, type);
CREATE INDEX idx_entities_name ON entities(name);
CREATE INDEX idx_rels_source ON relationships(source_entity_id);
CREATE INDEX idx_rels_target ON relationships(target_entity_id);
CREATE INDEX idx_mentions_entity ON entity_mentions(entity_id);
CREATE INDEX idx_mentions_content ON entity_mentions(content_id);
