# Contributing to NextVault

First off, thank you for considering contributing to NextVault! It's not just a project; it's an exploration into the future of human memory.

## 🛠 Engineering Standards

NextVault follows a strict architectural boundary system to prevent the "AI-Wrapper" trap.

### 1. Architectural Boundaries
- **Application Layer (UI):** Purely presentational. No direct DB or AI calls.
- **Orchestration Layer:** Coordinates the flow between retrieval and intelligence.
- **Intelligence Layer:** Pure AI logic and prompt engineering.
- **Knowledge Layer:** Data persistence and graph structures.
- **Retrieval Layer:** Vector search and ranking.

### 2. The "Vision Filter"
Before implementing any feature, ask:
**"Does this make NextVault better at understanding, connecting, retrieving, and developing human knowledge?"**
If the answer is "No" or "It just looks cool," the feature should be questioned or simplified.

### 3. Git Workflow
- **Branching:** Use `feature/*` or `fix/*` branches. `main` must always be stable.
- **Commits:** Use the imperative mood.
    - ✅ `Implement semantic document retrieval`
    - ❌ `updated some stuff`
- **Definition of Done:**
    - [ ] Code follows architectural boundaries.
    - [ ] Verified against critical edge cases.
    - [ ] Responsive design works across mobile and desktop.
    - [ ] No secrets committed.
    - [ ] Documentation updated.

## 🧪 Testing
We prioritize functional reliability over feature count. Ensure every PR includes:
- **Happy Path:** Does the feature work as expected?
- **Edge Cases:** Empty inputs, huge files, network failures.
- **Security:** Verify that tenant isolation is maintained.

## 📜 License
This project is licensed under the MIT License.
