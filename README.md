# NextVault 🌌
**The Operating System for Human Knowledge.**

![Version](https://img.shields.io/badge/version-0.1.0--alpha-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Stack](https://img.shields.io/badge/stack-Fastify%20%7C%20PostgreSQL%20%7C%20pgvector-black)

NextVault is not a note-taking application, a document manager, or a productivity tool. It is a fundamental rethink of how humans store, retrieve, connect, and develop knowledge over time.

## 👁️ The Vision
We live in an era of information abundance but memory fragmentation. We consume vast amounts of data, but that knowledge remains trapped in isolated files, forgotten folders, and the limitations of biological memory.

**NextVault is designed to be a persistent, intelligent memory layer between humans and the information they encounter throughout their lives.**

Instead of treating knowledge as static files, NextVault treats it as a **living system**—where information is understood semantically, connected automatically, and developed continuously.

---

## 🚀 Core Pillars

### 🧠 The Memory Engine™
The foundation of NextVault. It transforms raw, fragmented information into persistent, interconnected knowledge.
- **Semantic Ingestion:** Moves beyond keywords to understand the *meaning* of content.
- **Vector Representation:** Utilizes high-dimensional embeddings to map concepts in a latent space.
- **Atomic Retrieval:** Retrieves knowledge based on context and intent, not just exact matches.

### 🌙 Overnight Intelligence™
Knowledge work shouldn't stop when the user does. NextVault operates in the background to synthesize information.
- **Relationship Discovery:** Identifying connections between ideas learned months apart.
- **Automatic Synthesis:** Preparing insights and surfacing relevant patterns while the user is away.
- **Active Curation:** Transforming a passive database into an active intelligence layer.

### 🕸️ Living Knowledge Graph
A structural representation of human understanding.
- **Entity-Relationship Mapping:** Connecting People $\rightarrow$ Concepts $\rightarrow$ Documents $\rightarrow$ Projects.
- **Evolutionary Memory:** Tracking how a user's understanding of a topic evolves over time.
- **Contextual Navigation:** Moving through knowledge via meaning-based traversal.

---

## 🛠 Technical Architecture

NextVault is built on a modular, provider-agnostic architecture to ensure it can evolve alongside AI advancements.

```mermaid
graph TD
    A[Knowledge Capture] --> B[Memory Engine]
    B --> C{Orchestration Layer}
    C --> D[Knowledge Layer: Graph + Vector DB]
    C --> E[Intelligence Layer: LLMs]
    D --> F[User Experience]
    E --> F
    F --> A
```

### The Stack
| Component | Technology | Why? |
| :--- | :--- | :--- |
| **API Framework** | Fastify | Ultra-low overhead, high throughput, and strict schema validation. |
| **Primary Database** | PostgreSQL | Relational reliability for user data and metadata. |
| **Vector Engine** | pgvector | Tight integration of relational data and semantic vectors in one ACID-compliant store. |
| **Embeddings** | OpenAI / Local | High-dimensional semantic mapping for deep understanding. |
| **Language** | TypeScript | Type-safety for complex data orchestrations. |

---

## 🏁 Getting Started

### Prerequisites
- Node.js v20+
- PostgreSQL 15+ with `pgvector` extension

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/jatinsahuin/Nextvault-main.git
   cd Nextvault-main
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (`.env`):
   ```env
   DATABASE_URL=postgres://user:pass@localhost:5432/nextvault
   OPENAI_API_KEY=your_key_here
   JWT_SECRET=your_secure_random_string
   STORAGE_ROOT=./storage
   ```

4. Start the server:
   ```bash
   npm run dev
   ```

---

## 🗺️ Roadmap

- [x] **Stage 1: Foundation** — Atomic Ingestion, Secure Vault, Semantic Indexing.
- [ ] **Stage 2: Intelligence** — Contextual Retrieval, Source-Aware Synthesis.
- [ ] **Stage 3: Living Knowledge** — Entity Graph, Relationship Discovery.
- [ ] **Stage 4: Overnight Intelligence™** — Background Synthesis, Insight Generation.

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.
