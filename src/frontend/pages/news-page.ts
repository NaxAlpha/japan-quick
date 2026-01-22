/**
 * News page component - Workflow-based version
 * POST /api/news/trigger to start workflow
 * Poll /api/news/status/:id every 2 seconds
 * Fetch /api/news/result/:id when complete
 * Load /api/news/latest on page open for immediate display
 * Shows article status badges and links to article pages when available
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

type ArticleStatus = 'pending' | 'not_available' | 'scraped_v1' | 'scraped_v2';

interface YahooNewsTopPick {
  title: string;
  url: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  pickId?: string;
  articleStatus?: ArticleStatus;
}

type FetchState = 'not-fetched' | 'triggering' | 'polling' | 'fetched';

@customElement('news-page')
export class NewsPage extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
    }

    .container {
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }

    h1 {
      color: white;
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
    }

    .scrape-button {
      padding: 0.75rem 1.5rem;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 0.5rem;
      color: white;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      width: 100%;
    }

    .scrape-button:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.3);
    }

    .scrape-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .news-list {
      margin-top: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .news-item {
      display: flex;
      align-items: center;
      background: white;
      border-radius: 0.5rem;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      transition: transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
    }

    .news-item:hover {
      transform: translateX(4px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .news-item-content {
      flex: 1;
      padding: 1rem;
      min-width: 0;
    }

    .news-title-row {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .news-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
      line-height: 1.4;
      color: #1a1a1a;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      flex: 1;
    }

    .news-date {
      font-size: 0.875rem;
      color: #666;
      margin: 0;
    }

    .news-thumbnail {
      width: 120px;
      height: 90px;
      object-fit: cover;
      background: #f0f0f0;
      flex-shrink: 0;
    }

    .news-placeholder-thumbnail {
      width: 120px;
      height: 90px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 1.5rem;
      flex-shrink: 0;
    }

    .status-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .status-badge.external {
      background: #9ca3af;
      color: white;
    }

    .status-badge.pending {
      background: #fbbf24;
      color: #78350f;
    }

    .status-badge.scraped-v1 {
      background: #3b82f6;
      color: white;
    }

    .status-badge.scraped-v2 {
      background: #10b981;
      color: white;
    }

    .status-badge.new {
      background: #8b5cf6;
      color: white;
    }

    .status-message {
      text-align: center;
      padding: 3rem 2rem;
      color: rgba(255, 255, 255, 0.8);
      font-size: 1.125rem;
    }

    .home-link {
      display: inline-block;
      margin-top: 2rem;
      padding: 0.5rem 1rem;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 0.5rem;
      color: white;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      text-decoration: none;
    }

    .home-link:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .snapshot-info {
      text-align: center;
      padding: 0.5rem;
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
  `;

  @state()
  private topPicks: YahooNewsTopPick[] = [];

  @state()
  private fetchState: FetchState = 'not-fetched';

  @state()
  private error: string | null = null;

  @state()
  private workflowId: string | null = null;

  @state()
  private statusMessage: string = '';

  @state()
  private snapshotInfo: string = '';

  private pollingInterval: number | null = null;

  /**
   * Generate Basic Auth headers for API requests
   */
  private getAuthHeaders(): HeadersInit {
    const username = 'admin';
    const password = 'GvkP525fTX0ocMTw8XtAqM9ECvNIx50v';
    const credentials = btoa(`${username}:${password}`);
    return {
      'Authorization': `Basic ${credentials}`
    };
  }

  connectedCallback() {
    super.connectedCallback();
    // Load latest snapshot on page open for immediate display
    this.loadLatestSnapshot();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopPolling();
  }

  private async loadLatestSnapshot() {
    try {
      const response = await fetch('/api/news/latest', {
        headers: this.getAuthHeaders()
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.snapshot?.data?.topPicks) {
          this.topPicks = result.snapshot.data.topPicks;
          this.fetchState = 'fetched';
          this.snapshotInfo = `Loaded snapshot from ${new Date(result.snapshot.capturedAt).toLocaleString()}`;
        }
      }
    } catch (err) {
      // No existing snapshot, stay in not-fetched state
      console.log('No existing snapshot found');
    }
  }

  private async triggerWorkflow() {
    this.fetchState = 'triggering';
    this.error = null;
    this.statusMessage = 'Creating workflow...';
    this.snapshotInfo = '';

    try {
      // POST to trigger endpoint
      const response = await fetch('/api/news/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify({ skipCache: false })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success || !data.workflowId) {
        throw new Error('Failed to create workflow');
      }

      this.workflowId = data.workflowId;
      this.statusMessage = 'Workflow created, starting...';
      this.fetchState = 'polling';

      // Start polling
      this.startPolling();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to trigger workflow';
      this.fetchState = 'not-fetched';
      this.statusMessage = '';
    }
  }

  private startPolling() {
    this.stopPolling(); // Clear any existing interval

    this.pollingInterval = window.setInterval(() => {
      this.checkWorkflowStatus();
    }, 2000); // Poll every 2 seconds

    // Check immediately
    this.checkWorkflowStatus();
  }

  private stopPolling() {
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async checkWorkflowStatus() {
    if (!this.workflowId) return;

    try {
      const response = await fetch(`/api/news/status/${this.workflowId}`, {
        headers: this.getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error('Failed to get workflow status');
      }

      this.statusMessage = `Workflow status: ${data.status}`;

      // Check if complete
      if (data.status === 'complete') {
        this.stopPolling();
        await this.fetchWorkflowResult();
      } else if (data.status === 'failed' || data.status === 'terminated') {
        this.stopPolling();
        this.error = `Workflow ${data.status}`;
        this.fetchState = 'not-fetched';
        this.statusMessage = '';
      }
    } catch (err) {
      console.error('Polling error:', err);
      // Continue polling on error
    }
  }

  private async fetchWorkflowResult() {
    if (!this.workflowId) return;

    try {
      const response = await fetch(`/api/news/result/${this.workflowId}`, {
        headers: this.getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.result) {
        throw new Error('Failed to get workflow result');
      }

      const result = data.result;
      if (result.success && result.data?.topPicks) {
        this.topPicks = result.data.topPicks;
        this.fetchState = 'fetched';
        this.statusMessage = '';
        if (result.snapshotName) {
          this.snapshotInfo = `New snapshot: ${result.snapshotName}`;
        }
      } else {
        throw new Error(result.error || 'Workflow failed');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch result';
      this.fetchState = 'not-fetched';
      this.statusMessage = '';
    } finally {
      this.workflowId = null;
    }
  }

  private getStatusBadge(topPick: YahooNewsTopPick) {
    const status = topPick.articleStatus;

    if (!status) {
      // No article record yet
      return html`<span class="status-badge new">New</span>`;
    }

    switch (status) {
      case 'not_available':
        return html`<span class="status-badge external">External</span>`;
      case 'pending':
        return html`<span class="status-badge pending">Pending</span>`;
      case 'scraped_v1':
        return html`<span class="status-badge scraped-v1">Scraped</span>`;
      case 'scraped_v2':
        return html`<span class="status-badge scraped-v2">Scraped v2</span>`;
      default:
        return html`<span class="status-badge new">New</span>`;
    }
  }

  private handleNewsClick(topPick: YahooNewsTopPick, event: Event) {
    event.preventDefault();

    // All articles go to article page now (for scraped and unscraped)
    if (topPick.pickId) {
      window.location.href = `/article/pick:${topPick.pickId}`;
      return;
    }

    // Fallback: open Yahoo page in new tab if no pickId
    window.open(topPick.url, '_blank', 'noopener,noreferrer');
  }

  render() {
    return html`
      <div class="container">
        <h1>Fetch Latest Top News</h1>

        <button
          @click=${this.triggerWorkflow}
          ?disabled=${this.fetchState === 'triggering' || this.fetchState === 'polling'}
          class="scrape-button"
        >
          ${this.fetchState === 'triggering' || this.fetchState === 'polling' ? 'Fetching...' : 'Scrape News'}
        </button>

        ${this.statusMessage ? html`<div class="status-message" style="padding: 1rem; font-size: 0.875rem;">${this.statusMessage}</div>` : ''}
        ${this.snapshotInfo ? html`<div class="snapshot-info">${this.snapshotInfo}</div>` : ''}

        ${this.renderContent()}

        <a href="/" class="home-link">Back to Home</a>
      </div>
    `;
  }

  private renderContent() {
    if (this.fetchState === 'not-fetched' && this.topPicks.length === 0) {
      return html`<div class="status-message">No news loaded. Click "Scrape News" to fetch latest news.</div>`;
    }

    if (this.fetchState === 'triggering' || this.fetchState === 'polling') {
      return html`<div class="status-message">Fetching news from workflow...</div>`;
    }

    if (this.error && this.topPicks.length === 0) {
      return html`<div class="status-message" style="color: rgba(239, 68, 68, 0.9)">Error: ${this.error}</div>`;
    }

    if (this.topPicks.length === 0) {
      return html`<div class="status-message">No news found</div>`;
    }

    return html`
      <div class="news-list">
        ${this.topPicks.map(
          (topPick) => html`
            <div
              class="news-item"
              @click=${(e: Event) => this.handleNewsClick(topPick, e)}
            >
              <div class="news-item-content">
                <div class="news-title-row">
                  <h3 class="news-title">${topPick.title}</h3>
                  ${this.getStatusBadge(topPick)}
                </div>
                ${topPick.publishedAt ? html`<p class="news-date">${topPick.publishedAt}</p>` : ''}
              </div>
              ${topPick.thumbnailUrl
                ? html`<img class="news-thumbnail" src="${topPick.thumbnailUrl}" alt="" />`
                : html`<div class="news-placeholder-thumbnail">📰</div>`}
            </div>
          `
        )}
      </div>
    `;
  }
}
