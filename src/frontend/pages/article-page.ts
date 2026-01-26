/**
 * Article page component
 * Displays scraped article content with version selector
 * Load article from /api/articles/pick:{pickId} or /api/articles/{articleId}
 *
 * Tokyo Cyber-Industrial aesthetic
 */

import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

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

    /* Japanese character decoration */
    .japanese-deco {
      position: fixed;
      font-family: 'Zen Tokyo Zoo', sans-serif;
      font-size: clamp(10rem, 25vw, 20rem);
      color: rgba(230, 57, 70, 0.03);
      line-height: 1;
      pointer-events: none;
      z-index: 0;
      user-select: none;
    }

    .japanese-deco.top {
      top: 10%;
      right: -5%;
      transform: rotate(5deg);
    }

    .japanese-deco.bottom {
      bottom: 5%;
      left: -5%;
      transform: rotate(-5deg);
    }

    /* Back link */
    .back-link {
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
      margin-bottom: 2rem;
      position: relative;
      z-index: 1;
    }

    .back-link:hover {
      background: #e63946;
      border-color: #e63946;
      transform: translate(-1px, -1px);
      box-shadow: 3px 3px 0 #0a0a0a;
    }

    /* Article header card */
    .article-header {
      background: #ffffff;
      border: 3px solid #0a0a0a;
      box-shadow: 4px 4px 0 #0a0a0a;
      padding: 2rem;
      margin-bottom: 1.5rem;
      position: relative;
      z-index: 1;
    }

    .article-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: #e63946;
    }

    .article-title {
      font-family: 'Zen Tokyo Zoo', sans-serif;
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
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      font-weight: 400;
      color: #e63946;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 0.25rem 0.625rem;
      border: 1px solid #e63946;
    }

    .article-date {
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      color: #78746c;
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

    .status-badge.retry-1,
    .status-badge.retry-2 {
      background: #f97316;
      color: #ffffff;
      border-color: #f97316;
    }

    .status-badge.error {
      background: #ef4444;
      color: #ffffff;
      border-color: #ef4444;
    }

    /* Version selector */
    .version-selector {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }

    .version-button {
      padding: 0.5rem 1rem;
      border: 2px solid #0a0a0a;
      background: #ffffff;
      color: #0a0a0a;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      transition: all 0.15s ease-out;
      box-shadow: 2px 2px 0 #0a0a0a;
    }

    .version-button:hover {
      transform: translate(-1px, -1px);
      box-shadow: 3px 3px 0 #0a0a0a;
    }

    .version-button.active {
      background: #0a0a0a;
      color: #e63946;
      border-color: #0a0a0a;
    }

    /* Original link */
    .original-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1rem;
      color: #0a0a0a;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      text-decoration: none;
      padding: 0.5rem 0;
      border-bottom: 2px solid #e63946;
      transition: all 0.15s ease-out;
    }

    .original-link:hover {
      color: #e63946;
      padding-left: 0.25rem;
    }

    .original-link::before {
      content: '↗';
      font-size: 0.875rem;
    }

    /* Article content */
    .article-content {
      background: #ffffff;
      border: 3px solid #0a0a0a;
      box-shadow: 4px 4px 0 #0a0a0a;
      padding: 2rem;
      margin-bottom: 1.5rem;
      position: relative;
      z-index: 1;
    }

    .article-content::before {
      content: 'CONTENT';
      position: absolute;
      top: 0;
      left: 0;
      padding: 0.25rem 0.625rem;
      background: #0a0a0a;
      color: #e63946;
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .article-content h2 {
      font-family: 'Zen Tokyo Zoo', sans-serif;
      font-size: clamp(1.25rem, 3vw, 1.5rem);
      font-weight: 400;
      color: #0a0a0a;
      margin: 0 0 1.5rem 0;
      padding-top: 1rem;
      text-transform: uppercase;
    }

    .article-body {
      font-family: 'Inter', 'Noto Sans JP', sans-serif;
      font-size: 1rem;
      line-height: 1.8;
      color: #1a1a1a;
    }

    .article-body p {
      margin-bottom: 1.25rem;
    }

    .article-body h2 {
      font-family: 'Inter', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      color: #0a0a0a;
      margin: 2rem 0 1rem;
      text-transform: none;
    }

    .article-body h3 {
      font-family: 'Inter', sans-serif;
      font-size: 1.125rem;
      font-weight: 600;
      color: #0a0a0a;
      margin: 1.5rem 0 0.75rem;
    }

    .article-body img {
      max-width: 100%;
      height: auto;
      border: 2px solid #0a0a0a;
      margin: 1.5rem 0;
      box-shadow: 3px 3px 0 rgba(10, 10, 10, 0.3);
    }

    .article-body ul,
    .article-body ol {
      margin-bottom: 1.25rem;
      padding-left: 1.5rem;
    }

    .article-body li {
      margin-bottom: 0.5rem;
    }

    .no-content {
      color: #78746c;
      font-family: 'Space Mono', monospace;
      font-size: 0.875rem;
      font-style: italic;
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

    /* Trigger button */
    .trigger-button {
      width: 100%;
      padding: 0.875rem 1.5rem;
      background: #e63946;
      border: 3px solid #e63946;
      color: #ffffff;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: all 0.15s ease-out;
      box-shadow: 4px 4px 0 #0a0a0a;
      margin-top: 1rem;
    }

    .trigger-button:hover:not(:disabled) {
      background: #0a0a0a;
      border-color: #0a0a0a;
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 #e63946;
    }

    .trigger-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    /* Polling status */
    .polling-status {
      padding: 0.75rem;
      background: rgba(230, 57, 70, 0.1);
      border: 2px solid #e63946;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      color: #e63946;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .polling-status::before {
      content: '';
      width: 8px;
      height: 8px;
      background: #e63946;
      border-radius: 50%;
      animation: pulse 1s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }

    /* Comments section */
    .comments-section {
      background: #ffffff;
      border: 3px solid #0a0a0a;
      box-shadow: 4px 4px 0 #0a0a0a;
      padding: 2rem;
      position: relative;
      z-index: 1;
    }

    .comments-section::before {
      content: 'COMMENTS';
      position: absolute;
      top: 0;
      left: 0;
      padding: 0.25rem 0.625rem;
      background: #0a0a0a;
      color: #e63946;
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .comments-title {
      font-family: 'Zen Tokyo Zoo', sans-serif;
      font-size: clamp(1.25rem, 3vw, 1.5rem);
      font-weight: 400;
      color: #0a0a0a;
      margin: 0 0 1.5rem 0;
      padding-top: 1rem;
      text-transform: uppercase;
    }

    .comment {
      padding: 1rem 0;
      border-bottom: 2px solid #e8e6e1;
    }

    .comment:last-child {
      border-bottom: none;
    }

    .comment-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .comment-author {
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      font-weight: 400;
      color: #0a0a0a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.25rem 0.5rem;
      background: #f5f3f0;
      border: 1px solid #0a0a0a;
    }

    .comment-date {
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      color: #78746c;
    }

    .comment-content {
      font-family: 'Inter', 'Noto Sans JP', sans-serif;
      font-size: 0.9375rem;
      color: #1a1a1a;
      line-height: 1.6;
    }

    .comment-footer {
      display: flex;
      gap: 1rem;
      margin-top: 0.75rem;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      color: #78746c;
    }

    .comment-footer span {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    /* Loading and error states */
    .loading,
    .error {
      text-align: center;
      padding: 3rem;
      font-family: 'Space Mono', monospace;
      position: relative;
      z-index: 1;
    }

    .loading {
      color: #78746c;
      font-size: 0.875rem;
    }

    .error {
      color: #e63946;
      font-size: 1rem;
    }

    .loading-spinner {
      display: inline-block;
      width: 2rem;
      height: 2rem;
      border: 3px solid #e8e6e1;
      border-top-color: #e63946;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 640px) {
      .container {
        padding: 1rem;
      }

      .article-header,
      .article-content,
      .comments-section {
        padding: 1.5rem;
      }

      .metadata-section {
        padding: 1rem;
      }

      .version-selector {
        flex-direction: column;
      }

      .version-button {
        width: 100%;
        text-align: center;
      }
    }
  `;

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
        headers: this.getAuthHeaders()
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
        { headers: this.getAuthHeaders() }
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
          ...this.getAuthHeaders()
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
          headers: this.getAuthHeaders()
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
              View original on Yahoo
            </a>
          ` : ''}
        </div>

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

        <div class="article-content">
          <h2>Content</h2>
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
                  <span>♥ ${comment.likes}</span>
                  ${comment.repliesCount > 0 ? html`<span>💬 ${comment.repliesCount}</span>` : ''}
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
