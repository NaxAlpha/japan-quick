/**
 * News page component - Yahoo News Japan feed
 * POST /api/news/trigger to start workflow
 * Poll /api/news/status/:id every 2 seconds
 * Fetch /api/news/result/:id when complete
 * Load /api/news/latest on page open for immediate display
 * Shows article status badges and links to article pages when available
 *
 * Tokyo Editorial Cyber-Industrial aesthetic
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
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Zen+Tokyo+Zoo&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Inter:wght@400;500;600;700;800&display=swap');

    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
    }

    .container {
      padding: 2rem;
      max-width: 900px;
      margin: 0 auto;
      background: #f5f3f0;
      min-height: 100vh;
      position: relative;
    }

    /* Background pattern */
    .container::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: url("data:image/svg+xml,%3Csvg width='120' height='60' viewBox='0 0 120 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 30 Q 15 15, 30 30 T 60 30 T 90 30 T 120 30' stroke='%23e63946' stroke-width='0.5' fill='none' opacity='0.06'/%3E%3C/svg%3E");
      background-size: 120px 60px;
      pointer-events: none;
      z-index: 0;
    }

    /* Header */
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 2rem;
      position: relative;
      z-index: 1;
      flex-wrap: wrap;
    }

    .header-left {
      flex: 1;
      min-width: 280px;
    }

    .home-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #0a0a0a;
      color: #ffffff;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      border: 2px solid #0a0a0a;
      text-decoration: none;
      transition: all 0.15s ease-out;
      box-shadow: 2px 2px 0 #0a0a0a;
      margin-bottom: 1.5rem;
    }

    .home-link:hover {
      background: #e63946;
      border-color: #e63946;
      transform: translate(-1px, -1px);
      box-shadow: 3px 3px 0 #0a0a0a;
    }

    h1 {
      font-family: 'Zen Tokyo Zoo', sans-serif;
      font-size: clamp(1.75rem, 5vw, 2.5rem);
      font-weight: 400;
      line-height: 1;
      color: #0a0a0a;
      margin: 0;
      text-transform: uppercase;
    }

    h1 .accent {
      color: #e63946;
    }

    .header-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.75rem;
    }

    /* Scrape button */
    .scrape-button {
      padding: 0.875rem 1.5rem;
      background: #e63946;
      color: #ffffff;
      border: 3px solid #e63946;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: all 0.15s ease-out;
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .scrape-button:hover:not(:disabled) {
      background: #0a0a0a;
      border-color: #0a0a0a;
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 #0a0a0a;
    }

    .scrape-button:focus-visible {
      outline: 3px solid #e63946;
      outline-offset: 3px;
    }

    .scrape-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    /* Snapshot info */
    .snapshot-info {
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      color: #78746c;
    }

    .snapshot-info .timestamp {
      color: #e63946;
      font-weight: 700;
    }

    /* News list */
    .news-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      position: relative;
      z-index: 1;
    }

    .news-item {
      display: flex;
      align-items: stretch;
      background: #ffffff;
      border: 3px solid #0a0a0a;
      box-shadow: 4px 4px 0 #0a0a0a;
      cursor: pointer;
      transition: all 0.15s ease-out;
      text-decoration: none;
      color: inherit;
      position: relative;
      overflow: hidden;
    }

    .news-item::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: #e63946;
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.2s ease-out;
    }

    .news-item:hover {
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 #0a0a0a;
    }

    .news-item:hover::before {
      transform: scaleX(1);
    }

    .news-item:focus-visible {
      outline: 3px solid #e63946;
      outline-offset: 3px;
    }

    .news-thumbnail {
      width: 140px;
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
      background: #f5f3f0;
    }

    .news-thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .news-placeholder-thumbnail {
      width: 140px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0a0a0a;
      color: #e63946;
      font-family: 'Zen Tokyo Zoo', sans-serif;
      font-size: 2.5rem;
    }

    .news-item-content {
      flex: 1;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 0;
    }

    .news-title-row {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .news-title {
      font-family: 'Inter', sans-serif;
      font-size: 1rem;
      font-weight: 700;
      color: #0a0a0a;
      margin: 0;
      line-height: 1.4;
      flex: 1;
    }

    .status-badge {
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      font-weight: 400;
      padding: 0.25rem 0.5rem;
      border: 1px solid #0a0a0a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .status-badge.new {
      background: #e63946;
      color: #ffffff;
      border-color: #e63946;
    }

    .status-badge.external {
      background: #78746c;
      color: #ffffff;
      border-color: #78746c;
    }

    .status-badge.pending {
      background: #e9c46a;
      color: #78350f;
      border-color: #e9c46a;
    }

    .status-badge.scraped-v1 {
      background: #0066cc;
      color: #ffffff;
      border-color: #0066cc;
    }

    .status-badge.scraped-v2 {
      background: #2d6a4f;
      color: #ffffff;
      border-color: #2d6a4f;
    }

    .news-meta {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      color: #78746c;
    }

    .news-date {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .news-date::before {
      content: '📅';
    }

    /* Status messages */
    .status-message {
      text-align: center;
      padding: 4rem 2rem;
      font-family: 'Inter', sans-serif;
      font-size: 1rem;
      color: #58544c;
      position: relative;
      z-index: 1;
    }

    .status-message.error {
      color: #e63946;
    }

    .status-message.polling {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .loading-spinner {
      display: inline-block;
      width: 2rem;
      height: 2rem;
      border: 3px solid #e8e6e1;
      border-top-color: #e63946;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Footer */
    .footer {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 2px solid #e8e6e1;
      display: flex;
      justify-content: center;
      position: relative;
      z-index: 1;
    }

    .home-link-footer {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #0a0a0a;
      color: #ffffff;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      border: 2px solid #0a0a0a;
      text-decoration: none;
      transition: all 0.15s ease-out;
      box-shadow: 2px 2px 0 #0a0a0a;
    }

    .home-link-footer:hover {
      background: #e63946;
      border-color: #e63946;
      transform: translate(-1px, -1px);
      box-shadow: 3px 3px 0 #0a0a0a;
    }

    @media (max-width: 640px) {
      .news-item {
        flex-direction: column;
      }

      .news-thumbnail,
      .news-placeholder-thumbnail {
        width: 100%;
        height: 140px;
      }

      .news-title-row {
        flex-direction: column;
        gap: 0.5rem;
      }
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
          this.snapshotInfo = `From: ${new Date(result.snapshot.capturedAt).toLocaleString()}`;
        }
      }
    } catch (err) {
      console.log('No existing snapshot found');
    }
  }

  private async triggerWorkflow() {
    this.fetchState = 'triggering';
    this.error = null;
    this.statusMessage = 'Creating workflow...';
    this.snapshotInfo = '';

    try {
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

      this.startPolling();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to trigger workflow';
      this.fetchState = 'not-fetched';
      this.statusMessage = '';
    }
  }

  private startPolling() {
    this.stopPolling();

    this.pollingInterval = window.setInterval(() => {
      this.checkWorkflowStatus();
    }, 2000);

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

      this.statusMessage = `Status: ${data.status}`;

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
          this.snapshotInfo = `Fresh: ${new Date().toLocaleString()}`;
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
      return html`<span class="status-badge new">New</span>`;
    }

    switch (status) {
      case 'not_available':
        return html`<span class="status-badge external">Ext</span>`;
      case 'pending':
        return html`<span class="status-badge pending">Wait</span>`;
      case 'scraped_v1':
        return html`<span class="status-badge scraped-v1">v1</span>`;
      case 'scraped_v2':
        return html`<span class="status-badge scraped-v2">v2</span>`;
      default:
        return html`<span class="status-badge new">New</span>`;
    }
  }

  private handleNewsClick(topPick: YahooNewsTopPick, event: Event) {
    event.preventDefault();

    if (topPick.pickId) {
      window.location.href = `/article/pick:${topPick.pickId}`;
      return;
    }

    window.open(topPick.url, '_blank', 'noopener,noreferrer');
  }

  render() {
    return html`
      <div class="container">
        <div class="page-header">
          <div class="header-left">
            <a href="/" class="home-link">← Home</a>
            <h1>News<span class="accent">Feed</span></h1>
          </div>
          <div class="header-right">
            <button
              @click=${this.triggerWorkflow}
              ?disabled=${this.fetchState === 'triggering' || this.fetchState === 'polling'}
              class="scrape-button"
            >
              ${this.fetchState === 'triggering' || this.fetchState === 'polling' ? '[ FETCHING... ]' : '[ Scrape News ]'}
            </button>
            ${this.snapshotInfo ? html`
              <div class="snapshot-info">
                <span class="timestamp">${this.snapshotInfo}</span>
              </div>
            ` : ''}
          </div>
        </div>

        ${this.renderContent()}

        <div class="footer">
          <a href="/" class="home-link-footer">← Back to Home</a>
        </div>
      </div>
    `;
  }

  private renderContent() {
    if (this.fetchState === 'not-fetched' && this.topPicks.length === 0) {
      return html`<div class="status-message">No news loaded. Click "Scrape News" to fetch latest stories.</div>`;
    }

    if (this.fetchState === 'triggering' || this.fetchState === 'polling') {
      return html`
        <div class="status-message polling">
          <span class="loading-spinner"></span>
          <span>${this.statusMessage}</span>
        </div>
      `;
    }

    if (this.error && this.topPicks.length === 0) {
      return html`<div class="status-message error">[ ERROR: ${this.error} ]</div>`;
    }

    if (this.topPicks.length === 0) {
      return html`<div class="status-message">No news found</div>`;
    }

    return html`
      <div class="news-list">
        ${this.topPicks.map(
          (topPick) => html`
            <a
              class="news-item"
              href="${topPick.pickId ? `/article/pick:${topPick.pickId}` : topPick.url}"
              @click=${(e: Event) => this.handleNewsClick(topPick, e)}
            >
              ${topPick.thumbnailUrl
                ? html`<div class="news-thumbnail"><img src="${topPick.thumbnailUrl}" alt="" /></div>`
                : html`<div class="news-placeholder-thumbnail">📰</div>`
              }
              <div class="news-item-content">
                <div class="news-title-row">
                  <h3 class="news-title">${topPick.title}</h3>
                  ${this.getStatusBadge(topPick)}
                </div>
                ${topPick.publishedAt ? html`
                  <div class="news-meta">
                    <span class="news-date">${topPick.publishedAt}</span>
                  </div>
                ` : ''}
              </div>
            </a>
          `
        )}
      </div>
    `;
  }
}
