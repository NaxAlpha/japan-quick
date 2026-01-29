/**
 * Article page component
 * Displays scraped article content with version selector
 * Load article from /api/articles/pick:{pickId} or /api/articles/{articleId}
 *
 * Tokyo Cyber-Industrial aesthetic
 */

import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { getAuthHeaders } from '../lib/auth.js';
import { baseStyles, buttonStyles, badgeStyles, loadingStyles } from '../styles/shared-styles.js';
import { createPoller, type Poller } from '../lib/polling.js';
import { POLLING, STATUS, TERMINAL_STATES } from '../lib/constants.js';
import '../components/article-header.js';
import '../components/article-content.js';
import '../components/article-comments.js';

type ArticleStatus = 'pending' | 'not_available' | 'scraped_v1' | 'scraped_v2';

interface Article {
  id: number;
  pickId: string;
  articleId?: string;
  articleUrl?: string;
  status: ArticleStatus;
  title?: string;
  source?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  modifiedAt?: string;
  detectedAt: string;
  firstScrapedAt?: string;
  secondScrapedAt?: string;
}

interface ArticleVersion {
  id: number;
  articleId: number;
  version: number;
  content: string;
  contentText?: string;
  pageCount: number;
  images?: string;
  scrapedAt: string;
}

interface ArticleComment {
  id: number;
  author?: string;
  content: string;
  postedAt?: string;
  likes: number;
  repliesCount: number;
}

@customElement('article-page')
export class ArticlePage extends LitElement {
  static styles = [
    baseStyles,
    buttonStyles,
    badgeStyles,
    loadingStyles,
    css`
    .container {
      max-width: 900px;
    }

    /* Metadata section */
    .metadata-section {
      background: #0a0a0a;
      border: 3px solid #0a0a0a;
      box-shadow: 4px 4px 0 #e63946;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      position: relative;
      z-index: 1;
    }

    .metadata-section::before {
      content: 'METADATA';
      position: absolute;
      top: 0;
      left: 0;
      padding: 0.25rem 0.625rem;
      background: #e63946;
      color: #ffffff;
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .metadata-row {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
      padding-top: 0.5rem;
    }

    .metadata-row:last-child {
      margin-bottom: 0;
    }

    .metadata-label {
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      font-weight: 400;
      color: #e63946;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      min-width: 100px;
      flex-shrink: 0;
    }

    .metadata-value {
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      color: #f5f3f0;
      word-break: break-all;
    }

    .metadata-value a {
      color: #e63946;
      text-decoration: none;
      border-bottom: 1px dashed #e63946;
    }

    .metadata-value a:hover {
      color: #ffffff;
      border-bottom-style: solid;
    }

    .trigger-button {
      width: 100%;
      margin-top: 1rem;
    }
  `];


  @property({ type: String })
  articleId: string = '';

  @state()
  private article: Article | null = null;

  @state()
  private versions: ArticleVersion[] = [];

  @state()
  private comments: ArticleComment[] = [];

  @state()
  private selectedVersion: number = 1;

  @state()
  private loading: boolean = true;

  @state()
  private error: string | null = null;

  @state()
  private workflowId: string | null = null;

  @state()
  private isPolling: boolean = false;

  @state()
  private pollStatus: string = '';

  @state()
  private triggerError: string | null = null;

  private workflowPoller: Poller | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.loadArticle();
  }

  private async loadArticle() {
    if (!this.articleId) {
      this.error = 'No article ID provided';
      this.loading = false;
      return;
    }

    try {
      const response = await fetch(`/api/articles/${this.articleId}`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 404) {
          this.error = 'Article not found';
        } else {
          this.error = `Failed to load article: HTTP ${response.status}`;
        }
        this.loading = false;
        return;
      }

      const data = await response.json();
      if (!data.success) {
        this.error = data.error || 'Failed to load article';
        this.loading = false;
        return;
      }

      this.article = data.article;
      this.versions = data.versions || [];
      this.comments = data.comments || [];

      // Set selected version to latest
      if (this.versions.length > 0) {
        this.selectedVersion = this.versions[this.versions.length - 1].version;
      }

      this.loading = false;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load article';
      this.loading = false;
    }
  }

  private async loadVersionComments(version: number) {
    if (!this.article) return;

    try {
      const response = await fetch(
        `/api/articles/pick:${this.article.pickId}/version/${version}`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.comments = data.comments || [];
        }
      }
    } catch (err) {
      console.error('Failed to load comments for version:', err);
    }
  }

  private handleVersionChange(version: number) {
    this.selectedVersion = version;
    this.loadVersionComments(version);
  }

  private getStatusBadge(status: ArticleStatus) {
    switch (status) {
      case 'scraped_v1':
        return html`<span class="status-badge scraped-v1">Scraped v1</span>`;
      case 'scraped_v2':
        return html`<span class="status-badge scraped-v2">Scraped v2</span>`;
      case 'not_available':
        return html`<span class="status-badge not-available">External</span>`;
      case 'pending':
        return html`<span class="status-badge pending">Pending</span>`;
      default:
        return html``;
    }
  }

  private getCurrentVersion(): ArticleVersion | undefined {
    return this.versions.find(v => v.version === this.selectedVersion);
  }

  private isUnscraped(): boolean {
    return !this.article || ['pending', 'not_available', 'retry_1', 'retry_2', 'error'].includes(this.article.status);
  }

  private async triggerScraping() {
    if (!this.article || this.isPolling) return;

    this.triggerError = null;
    this.isPolling = true;
    this.pollStatus = 'Starting workflow...';

    try {
      const response = await fetch(`/api/articles/trigger/${this.article.pickId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to start workflow');
      }

      this.workflowId = data.workflowId;
      this.startPolling();
    } catch (err) {
      this.triggerError = err instanceof Error ? err.message : 'Failed to trigger scraping';
      this.isPolling = false;
      this.pollStatus = '';
    }
  }

  private startPolling() {
    if (!this.workflowId) return;

    this.workflowPoller = createPoller({
      getEndpoint: () => `/api/articles/status/${this.workflowId!}`,
      intervalMs: POLLING.ARTICLE_POLL_INTERVAL_MS,
      terminalStates: [TERMINAL_STATES.WORKFLOW.COMPLETE, TERMINAL_STATES.WORKFLOW.FAILED],
      onStatus: (status) => {
        this.pollStatus = `Status: ${status}`;
      },
      onComplete: (terminalStatus) => {
        this.isPolling = false;
        if (terminalStatus === TERMINAL_STATES.WORKFLOW.COMPLETE) {
          this.pollStatus = 'Scraping complete! Reloading...';
          setTimeout(() => this.loadArticle(), POLLING.ARTICLE_POLL_INTERVAL_MS);
        } else {
          this.triggerError = 'Workflow failed';
          this.pollStatus = '';
        }
      },
      onError: (err) => {
        this.isPolling = false;
        this.triggerError = err.message || 'Workflow failed';
        this.pollStatus = '';
      }
    });

    this.workflowPoller.start();
  }

  disconnectedCallback() {
    if (this.workflowPoller) {
      this.workflowPoller.stop();
    }
    super.disconnectedCallback();
  }

  render() {
    if (this.loading) {
      return html`
        <div class="container">
          <a href="/news" class="back-link">← Back to News</a>
          <div class="loading">
            <div class="loading-spinner"></div>
            <div>Loading article...</div>
          </div>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="container">
          <a href="/news" class="back-link">← Back to News</a>
          <div class="error">[ ERROR: ${this.error} ]</div>
        </div>
      `;
    }

    if (!this.article) {
      return html`
        <div class="container">
          <a href="/news" class="back-link">← Back to News</a>
          <div class="error">Article not found</div>
        </div>
      `;
    }

    const currentVersion = this.getCurrentVersion();

    return html`
      <div class="container">
        <!-- Japanese character decorations -->
        <div class="japanese-deco top">読</div>
        <div class="japanese-deco bottom">報</div>

        <a href="/news" class="back-link">← Back to News</a>

        <article-header
          .articleId=${this.articleId}
          .pickId=${this.article.pickId}
          .title=${this.article.title || 'Untitled'}
          .source=${this.article.source}
          .publishedAt=${this.article.publishedAt}
          .articleUrl=${this.article.articleUrl}
          .status=${this.article.status}
          .versions=${this.versions}
          .selectedVersion=${this.selectedVersion}
          .isPolling=${this.isPolling}
          @version-change=${(e: CustomEvent) => this.handleVersionChange(e.detail.version)}
        ></article-header>

        ${this.isUnscraped() ? html`
          <div class="metadata-section">
            <div class="metadata-row">
              <span class="metadata-label">Pickup ID:</span>
              <span class="metadata-value">
                ${this.article?.pickId || '-'}
              </span>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Pickup URL:</span>
              <span class="metadata-value">
                ${this.article?.pickId ? html`<a href="https://news.yahoo.co.jp/pickup/${this.article.pickId}" target="_blank" rel="noopener noreferrer">https://news.yahoo.co.jp/pickup/${this.article.pickId}</a>` : '-'}
              </span>
            </div>
            ${this.article?.articleUrl ? html`
              <div class="metadata-row">
                <span class="metadata-label">Article URL:</span>
                <span class="metadata-value">
                  <a href="${this.article.articleUrl}" target="_blank" rel="noopener noreferrer">${this.article.articleUrl}</a>
                </span>
              </div>
            ` : ''}
            <div class="metadata-row">
              <span class="metadata-label">Detected:</span>
              <span class="metadata-value">${this.article?.detectedAt ? new Date(this.article.detectedAt).toLocaleString() : '-'}</span>
            </div>

            ${this.pollStatus ? html`<div class="polling-status">${this.pollStatus}</div>` : ''}

            <button
              class="trigger-button"
              ?disabled=${this.isPolling}
              @click=${this.triggerScraping}
            >
              ${this.isPolling ? '[ SCRAPING IN PROGRESS... ]' : '[ TRIGGER SCRAPING WORKFLOW ]'}
            </button>

            ${this.triggerError ? html`<div style="color: #e63946; font-family: 'Space Mono', monospace; font-size: 0.875rem; margin-top: 0.5rem;">[ ERROR: ${this.triggerError} ]</div>` : ''}
          </div>
        ` : ''}

        <article-content
          .status=${this.article.status}
          .version=${currentVersion}
        ></article-content>

        <article-comments
          .commentCount=${this.comments.length}
          .comments=${this.comments}
        ></article-comments>
      </div>
    `;
  }
}
