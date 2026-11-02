# NextVault Development Roadmap

NextVault is built in stages, moving from a stable foundation to an autonomous intelligence layer.

## 🟦 Stage 1: Foundation (Current)
**Goal:** Establish the basic "plumbing" for knowledge ingestion and security.
- [x] **Identity & Access:** Secure JWT-based authentication and tenant isolation.
- [x] **Atomic Ingestion:** Pipeline for raw file $\rightarrow$ text extraction $\rightarrow$ storage.
- [x] **Semantic Indexing:** Integration of `pgvector` and embedding models.
- [x] **Robustness Patch:** Implementation of semantic chunking and HNSW indexing for large-document support.
- [ ] **Basic Search API:** Endpoint for semantic retrieval of stored knowledge.

## 🟩 Stage 2: Intelligence
**Goal:** Move from simple retrieval to meaningful understanding.
- [ ] **Contextual Retrieval:** Reranking search results based on user intent.
- [ ] **Source-Aware Synthesis:** Generating answers that cite specific source documents.
- [ ] **Knowledge Cleaning:** Automated deduplication and conflict resolution in stored knowledge.
- [ ] **Interactive Refinement:** Allowing users to correct AI-derived summaries.

## 🟨 Stage 3: Living Knowledge
**Goal:** Transition from a vector list to a structured knowledge graph.
- [ ] **Entity Extraction:** Automatic identification of Concepts, People, and Projects.
- [ ] **Relationship Mapping:** Creating explicit edges (e.g., `CONCEPT_A` $\xrightarrow{contradicts}$ `CONCEPT_B`).
- [ ] **Graph Navigation:** UI/API for traversing the knowledge network.
- [ ] **Discovery Engine:** Surfacing "distant" but relevant connections.

## 🟧 Stage 4: Overnight Intelligence™
**Goal:** Implement the proactive synthesis layer.
- [ ] **Background Synthesis Workers:** Periodic processing of new knowledge.
- [ ] **Insight Generation:** Creating "Daily Briefs" of new connections found.
- [ ] **Automated Clustering:** Grouping related notes into emergent themes without user input.
- [ ] **Proactive Suggestions:** Notifying the user when new information contradicts or supports old knowledge.

## 🟥 Stage 5: Knowledge Infrastructure
**Goal:** Expand the system into a comprehensive ecosystem.
- [ ] **Multimodal Memory:** Handling images, audio, and video as first-class knowledge.
- [ ] **Local-First Architecture:** Moving processing to the edge for maximum privacy.
- [ ] **Extensible API:** Allowing other tools to plug into the NextVault knowledge layer.
- [ ] **Collaborative Vaults:** Securely sharing knowledge graphs between trusted users.
