# NextVault

**The Operating System for Human Knowledge.**

NextVault is an ambient intelligence layer designed to understand, connect, and synthesize everything you learn. It is not a note-taking app or a workspace—it is a cognitive extension built to ensure that no brilliant thought is ever lost to the noise of the information explosion.

[Vision & Constitution](VISION.md) | [Roadmap](ROADMAP.md) | [Engineering Guide](CLAUDE.md) | [Changelog](CHANGELOG.md)

---

## 🧠 The Core Idea

Digital memory is currently a series of "buckets"—folders, tags, and databases. But knowledge is a web. 

NextVault replaces the friction of manual indexing with a proactive system. It maps the semantic meaning of your data, identifying hidden relationships between disparate ideas and surfacing them exactly when they become relevant.

---

## 🛠 Technical Architecture

NextVault is built on a layered architecture to ensure intelligence can evolve without breaking the foundation:

- **Application Layer:** A premium, minimal, and technically sophisticated user experience.
- **Orchestration Layer:** Coordinates retrieval and intelligence processing.
- **Intelligence Layer:** LLMs and reasoning models for synthesis and understanding.
- **Retrieval Layer:** Hybrid semantic and keyword search infrastructure.
- **Knowledge Layer:** A persistent semantic knowledge graph of entities and relationships.

---

## 🚀 Current Status: Stage 1 (Foundation)

We are in the **Foundation** stage: a working backend for knowledge capture, with the product identity built in front of it.

### Current Progress
- [x] **Vision Prototype:** Cinematic landing experience with high-performance motion systems. *(Prototype: the product walkthrough on the page is an illustration, not connected to the backend.)*
- [x] **Product Constitution:** Defined architectural boundaries and development principles.
- [x] **Ingestion Pipeline (backend):** Upload `.txt` / `.md`, store the raw file, process it in the background into normalized text. *(Working. API only, no UI yet.)*
- [x] **Authentication & isolation (backend):** Supabase Auth verified via JWKS; every user's data is isolated; rate limited. *(Working. API only, no UI yet.)*
- [ ] **Memory Engine:** Chunking, embeddings, semantic search. *(Planned.)*
- [ ] **PDF ingestion.** *(Planned.)*

See [ROADMAP.md](ROADMAP.md) for what comes next and [CHANGELOG.md](CHANGELOG.md) for what has shipped.

---

## 💻 Quick Start

### Landing page (frontend)
```bash
git clone https://github.com/jatinsahuin/Nextvault-main.git
cd Nextvault-main
npm install
npm run dev
```
Open `http://localhost:3000` to experience the vision prototype.

### Backend API
The backend lives in [`server/`](server/) and needs Node 20+ and PostgreSQL. Setup, authentication, and testing steps are in [`server/README.md`](server/README.md).

---

© 2026 NextVault | Built for the future of human intelligence.
