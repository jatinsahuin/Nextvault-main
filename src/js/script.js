import { api } from './api.js';
import ForceGraph from 'force-graph';

class NextVaultUI {
  constructor() {
    this.state = {
      currentView: 'search',
      isProcessing: false,
      graph: null
    };

    // DOM Elements
    this.viewTitle = document.getElementById('view-title');
    this.viewDescription = document.getElementById('view-description');
    this.mainContent = document.getElementById('main-content');
    this.askInput = document.getElementById('ask-input');
    this.askButton = document.getElementById('ask-button');
    this.contextContent = document.getElementById('context-content');
    this.navItems = document.querySelectorAll('.nav-item');

    this.init();
  }

  init() {
    this.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        this.switchView(view);
      });
    });

    this.askButton.addEventListener('click', () => this.handleAsk());
    this.askInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleAsk();
    });
  }

  async switchView(view) {
    this.state.currentView = view;
    this.navItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === view);
    });

    const views = {
      search: { title: 'Semantic Search', desc: 'Query your accumulated knowledge.' },
      graph: { title: 'Living Graph', desc: 'Explore interconnected concepts.' },
      sources: { title: 'Source Vault', desc: 'Manage your raw information.' },
      insights: { title: 'Overnight Insights', desc: 'Proactive discoveries from the system.' },
      settings: { title: 'Settings', desc: 'Configure your knowledge infrastructure.' },
    };

    const current = views[view] || views.search;
    this.viewTitle.textContent = current.title;
    this.viewDescription.textContent = current.desc;
    this.mainContent.innerHTML = '';

    if (view === 'search') {
      this.mainContent.innerHTML = `
        <div class="result-card" style="text-align: center; color: var(--text-muted); border-style: dashed;">
            Your knowledge is ready. Ask anything.
        </div>`;
    } else if (view === 'graph') {
      this.initGraph();
    } else {
      this.mainContent.innerHTML = `
        <div class="result-card" style="text-align: center; color: var(--text-muted);">
            ${view} view is currently being implemented.
        </div>`;
    }
  }

  async initGraph() {
    const graphDiv = document.createElement('div');
    graphDiv.id = 'graph-container';
    graphDiv.style.width = '100%';
    graphDiv.style.height = 'calc(100vh - 200px)';
    this.mainContent.appendChild(graphDiv);

    try {
      const data = await api.getGraph();
      const Graph = ForceGraph()
        (graphDiv)
        .graphData(data)
        .nodeLabel('name')
        .nodeColor(() => '#ffffff')
        .nodeRelSize(6)
        .linkColor(() => '#333333')
        .linkDirectionalParticles(1)
        .linkDirectionalParticleSpeed(0.005)
        .onNodeClick(node => this.showEntityDetails(node.id));
    } catch (err) {
      this.mainContent.innerHTML = `<div class="result-card" style="color: red;">Failed to load graph.</div>`;
    }
  }

  async showEntityDetails(entityId) {
    this.contextContent.innerHTML = '<div style="color: var(--text-muted); text-align: center;">Loading entity...</div>';

    try {
      const data = await api.getEntityDetails(entityId);

      this.contextContent.innerHTML = `
        <div class="entity-detail">
          <div class="entity-name">${data.entity.name}</div>
          <div class="entity-type">${data.entity.type}</div>
          <div class="entity-desc">${data.entity.description || 'No description provided.'}</div>
        </div>

        <div class="context-header" style="margin-top: 2rem;">Connected Entities</div>
        <div class="related-list">
          ${data.related.map(r => `
            <div class="nav-item" style="cursor: pointer; margin-bottom: 0.5rem;" onclick="window.nextVault.showEntityDetails('${r.id}')">
              ${r.name}
            </div>
          `).join('')}
        </div>

        <div class="context-header" style="margin-top: 2rem;">Key Mentions</div>
        <div class="mentions-list">
          ${data.mentions.map(m => `
            <div class="result-card" style="font-size: 0.8rem; padding: 0.75rem; margin-bottom: 0.5rem;">
              ${m.extracted_text}
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      this.contextContent.innerHTML = '<div style="color: red;">Failed to load details.</div>';
    }
  }

  async handleAsk() {
    const query = this.askInput.value.trim();
    if (!query || this.state.isProcessing) return;
    this.setProcessing(true);
    try {
      const response = await api.ask(query);
      this.renderSynthesis(response);
    } catch (err) {
      this.renderError(err);
    } finally {
      this.setProcessing(false);
    }
  }

  setProcessing(processing) {
    this.state.isProcessing = processing;
    this.askButton.disabled = processing;
    this.askButton.textContent = processing ? '...' : 'Ask';
    if (processing) {
      this.mainContent.innerHTML = `
        <div class="result-card" style="text-align: center; color: var(--text-secondary);">
          Synthesizing knowledge...
        </div>`;
    }
  }

  renderSynthesis(data) {
    const { answer, sources } = data;
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="result-answer">${answer}</div>
      <div class="result-sources">
        ${sources.map((s, i) => `
          <div class="source-tag" data-source="${s.sourceFilename}">
            Source ${i + 1}: ${s.sourceFilename}
          </div>
        `).join('')}
      </div>
    `;
    if (this.mainContent.querySelector('div[style*="dashed"]')) {
      this.mainContent.innerHTML = '';
    }
    this.mainContent.prepend(card);
    this.askInput.value = '';
  }

  renderError(err) {
    this.mainContent.innerHTML = `
      <div class="result-card" style="border-color: #442222; color: #ff8888;">
        Error: ${err.message || 'An unexpected error occurred'}
      </div>
    `;
  }
}

window.nextVault = new NextVaultUI();
