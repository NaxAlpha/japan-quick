/**
 * Article page component
 * Displays scraped article content with version selector
 * Load article from /api/articles/pick:{pickId} or /api/articles/{articleId}
 *
 * Tokyo Editorial Cyber-Industrial aesthetic
 */

import { LitElement, html, unsafeCSS } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { getAuthHeaders } from '../lib/auth.js';
import {
  Colors,
  Typography,
  Spacing,
  Borders,
  Shadows,
  fontImports,
} from '../styles/design-system.js';

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
  static styles = unsafeCSS(fontImports + `
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
    }

    .container {
      padding: 1.5rem;
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

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 2rem;
      padding: 0.5rem 1rem;
      background: #0a0a0a;
      color: #ffffff;
      font-family: "Space Mono", monospace;
      font-size: 0.6875rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      border: 2px solid #0a0a0a;
      text-decoration: none;
      transition: all 0.15s ease-out;
      box-shadow: 2px 2px 0 #0a0a0a;
      position: relative;
      z-index: 1;
    }

    .back-link:hover {
      background: #e63946;
      border-color: #e63946;
      transform: translate(-1px, -1px);
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .article-header {
      background: #ffffff;
      border: 3px solid #0a0a0a;
      box-shadow: 4px 4px 0 #0a0a0a;
      padding: 2rem;
      margin-bottom: 2rem;
      position: relative;
      z-index: 1;
    }

    .article-title {
      font-family: "Zen Tokyo Zoo", system-ui, sans-serif;
      font-size: clamp(1.75rem, 5vw, 2.5rem);
      font-weight: 400;
      line-height: 1.1;
      color: #0a0a0a;
      margin: 0 0 1.5rem 0;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .article-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;
      margin-bottom: 1rem;
    }

    .article-source {
      font-family: "Space Mono", monospace;
      font-size: 0.6875rem;
      color: #e63946;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .article-date {
      font-family: "Space Mono", monospace;
      font-size: 0.6875rem;
      color: #78746c;
    }

    .status-badge {
      font-family: "Space Mono", monospace;
      font-size: 0.6875rem;
      font-weight: 400;
      padding: 0.25rem 0.625rem;
      border: 1px solid #0a0a0a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
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

    .status-badge.not-available {
      background: #78746c;
      color: #ffffff;
      border-color: #78746c;
    }

    .status-badge.pending {
      background: #e9c46a;
      color: #78350f;
      border-color: #e9c46a;
    }

    .version-selector {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .version-button {
      padding: 0.5rem 1rem;
      border: 1px solid #0a0a0a;
      background: #ffffff;
      color: #403c34;
      font-family: "Space Mono", monospace;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.15s ease-out;
      box-shadow: 2px 2px 0 #0a0a0a;
    }

    .version-button:hover {
      background: #e8e6e1;
      transform: translate(-1px, -1px);
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .version-button.active {
      background: #0066cc;
      color: #ffffff;
      border-color: #0066cc;
    }

    .article-content {
      background: #ffffff;
      border: 3px solid #0a0a0a;
      box-shadow: 4px 4px 0 #0a0a0a;
      padding: 2rem;
      margin-bottom: 2rem;
      position: relative;
      z-index: 1;
    }

    .article-content h2 {
      font-family: "Zen Tokyo Zoo", system-ui, sans-serif;
      font-size: clamp(1.25rem, 3vw, 1.75rem);
      font-weight: 400;
      color: #0a0a0a;
      margin: 0 0 1.5rem 0;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .article-body {
      font-family: "Inter", "Noto Sans JP", system-ui, sans-serif;
      font-size: 1rem;
      line-height: 1.75;
      color: #58544c;
    }

    .article-body p {
      margin-bottom: 1rem;
    }

    .article-body img {
      max-width: 100%;
      height: auto;
      border: 1px solid #0a0a0a;
      box-shadow: 2px 2px 0 #0a0a0a;
      margin: 1rem 0;
    }

    .comments-section {
      background: #ffffff;
      border: 3px solid #0a0a0a;
      box-shadow: 4px 4px 0 #0a0a0a;
      padding: 2rem;
      position: relative;
      z-index: 1;
    }

    .comments-title {
      font-family: "Zen Tokyo Zoo", system-ui, sans-serif;
      font-size: clamp(1.25rem, 3vw, 1.75rem);
      font-weight: 400;
      color: #0a0a0a;
      margin: 0 0 1.5rem 0;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .comment {
      padding: 1rem;
      border-bottom: 1px solid #0a0a0a;
    }

    .comment:last-child {
      border-bottom: none;
    }

    .comment-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .comment-author {
      font-family: "Inter", "Noto Sans JP", system-ui, sans-serif;
      font-weight: 700;
      color: #0a0a0a;
    }

    .comment-date {
      font-family: "Space Mono", monospace;
      font-size: 0.6875rem;
      color: #78746c;
    }

    .comment-content {
      font-family: "Inter", "Noto Sans JP", system-ui, sans-serif;
      font-size: 0.875rem;
      color: #58544c;
      line-height: 1.5;
    }

    .comment-footer {
      display: flex;
      gap: 1rem;
      margin-top: 0.5rem;
      font-family: "Space Mono", monospace;
      font-size: 0.6875rem;
      color: #78746c;
    }

    .loading,
    .error {
      text-align: center;
      padding: 4rem;
      position: relative;
      z-index: 1;
      font-family: "Inter", "Noto Sans JP", system-ui, sans-serif;
      font-size: 1.25rem;
    }

    .loading {
      color: #78746c;
    }

    .error {
      color: #e63946;
    }

    .no-content {
      color: #78746c;
      font-style: italic;
    }

    .original-link {
      display: inline-block;
      margin-top: 1rem;
      color: #0066cc;
      text-decoration: none;
      font-family: "Space Mono", monospace;
      font-size: 0.875rem;
    }

    .original-link:hover {
      text-decoration: underline;
    }

    .metadata-section {
      background: #ffffff;
      border: 3px solid #0a0a0a;
      box-shadow: 2px 2px 0 #0a0a0a;
      padding: 1.5rem;
      margin-bottom: 2rem;
      position: relative;
      z-index: 1;
    }

    .metadata-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .metadata-label {
      font-family: "Space Mono", monospace;
      font-size: 0.6875rem;
      color: #78746c;
      font-weight: 400;
      min-width: 80px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .metadata-value {
      font-family: "Space Mono", monospace;
      font-size: 0.875rem;
      color: #282420;
      word-break: break-all;
    }

    .metadata-value a {
      color: #0066cc;
      text-decoration: none;
    }

    .metadata-value a:hover {
      text-decoration: underline;
    }

    .trigger-button {
      padding: 0.625rem 1.25rem;
      background: #0066cc;
      border: 3px solid #0066cc;
      color: #ffffff;
      font-family: "Space Mono", monospace;
      font-size: 0.875rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: all 0.15s ease-out;
      box-shadow: 2px 2px 0 #0a0a0a;
    }

    .trigger-button:hover:not(:disabled) {
      background: #0a0a0a;
      border-color: #0a0a0a;
      transform: translate(-2px, -2px);
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .trigger-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .polling-status {
      padding: 1rem;
      background: #e8e6e1;
      border: 1px solid #0a0a0a;
      font-family: "Space Mono", monospace;
      font-size: 0.875rem;
      color: #0066cc;
      margin-bottom: 1rem;
    }

    .status-badge.retry-1,
    .status-badge.retry-2 {
      background: #e63946;
      color: #ffffff;
      border-color: #e63946;
    }

    .status-badge.error {
      background: #e63946;
      color: #ffffff;
      border-color: #e63946;
    }
  `);

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

  private pollingInterval: number | null = null;

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
        return html`<span class="status-badge scraped-v1">Scraped</span>`;
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
    this.pollingInterval = window.setInterval(async () => {
      if (!this.workflowId) {
        this.stopPolling();
        return;
      }

      try {
        const response = await fetch(`/api/articles/status/${this.workflowId}`, {
          headers: getAuthHeaders()
        });

        const data = await response.json();
        if (!data.success) {
          this.stopPolling();
          this.isPolling = false;
          this.pollStatus = '';
          return;
        }

        this.pollStatus = `Status: ${data.status}`;

        if (data.status === 'complete') {
          this.stopPolling();
          this.isPolling = false;
          this.pollStatus = 'Scraping complete! Reloading...';
          setTimeout(() => this.loadArticle(), 1000);
        } else if (data.status === 'failed') {
          this.stopPolling();
          this.isPolling = false;
          this.triggerError = 'Workflow failed';
          this.pollStatus = '';
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
  }

  private stopPolling() {
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopPolling();
  }

  render() {
    if (this.loading) {
      return html`
        <div class="container">
          <a href="/news" class="back-link">← Back to News</a>
          <div class="loading">Loading article...</div>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="container">
          <a href="/news" class="back-link">← Back to News</a>
          <div class="error">${this.error}</div>
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
        <a href="/news" class="back-link">← Back to News</a>

        <div class="article-header">
          <h1 class="article-title">${this.article.title || 'Untitled'}</h1>

          <div class="article-meta">
            ${this.article.source ? html`<span class="article-source">${this.article.source}</span>` : ''}
            ${this.article.publishedAt ? html`<span class="article-date">${this.article.publishedAt}</span>` : ''}
            ${this.getStatusBadge(this.article.status)}
          </div>

          ${this.versions.length > 1 ? html`
            <div class="version-selector">
              ${this.versions.map(v => html`
                <button
                  class="version-button ${v.version === this.selectedVersion ? 'active' : ''}"
                  @click=${() => this.handleVersionChange(v.version)}
                >
                  Version ${v.version}
                  (${new Date(v.scrapedAt).toLocaleDateString()})
                </button>
              `)}
            </div>
          ` : ''}

          ${this.article.articleUrl ? html`
            <a href="${this.article.articleUrl}" target="_blank" rel="noopener noreferrer" class="original-link">
              View original article on Yahoo
            </a>
          ` : ''}
        </div>

        ${this.isUnscraped() ? html`
          <div class="metadata-section">
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
              ${this.isPolling ? 'Scraping in progress...' : 'Trigger Scraping'}
            </button>

            ${this.triggerError ? html`<div style="color: #e63946; font-family: 'Space Mono', monospace; font-size: 0.875rem; margin-top: 0.5rem;">${this.triggerError}</div>` : ''}
          </div>
        ` : ''}

        <div class="article-content">
          <h2>Article Content</h2>
          ${currentVersion ? html`
            <div class="article-body">
              ${currentVersion.content ? unsafeHTML(currentVersion.content) : html`<p class="no-content">No content available</p>`}
            </div>
          ` : html`
            <p class="no-content">No content available for this version</p>
          `}
        </div>

        ${this.comments.length > 0 ? html`
          <div class="comments-section">
            <h2 class="comments-title">Comments (${this.comments.length})</h2>
            ${this.comments.map(comment => html`
              <div class="comment">
                <div class="comment-header">
                  <span class="comment-author">${comment.author || 'Anonymous'}</span>
                  ${comment.postedAt ? html`<span class="comment-date">${comment.postedAt}</span>` : ''}
                </div>
                <div class="comment-content">${comment.content}</div>
                <div class="comment-footer">
                  <span>${comment.likes} likes</span>
                  ${comment.repliesCount > 0 ? html`<span>${comment.repliesCount} replies</span>` : ''}
                </div>
              </div>
            `)}
          </div>
        ` : html`
          <div class="comments-section">
            <h2 class="comments-title">Comments</h2>
            <p class="no-content">No comments available</p>
          </div>
        `}
      </div>
    `;
  }
}
