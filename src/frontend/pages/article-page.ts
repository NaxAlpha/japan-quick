/**
 * Article page component
 * Displays scraped article content with version selector
 * Load article from /api/articles/pick:{pickId} or /api/articles/{articleId}
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
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
    }

    .container {
      padding: 2rem;
      max-width: 900px;
      margin: 0 auto;
    }

    .back-link {
      display: inline-block;
      margin-bottom: 1.5rem;
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

    .back-link:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .article-header {
      background: white;
      border-radius: 0.5rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .article-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1a1a1a;
      margin: 0 0 1rem 0;
      line-height: 1.4;
    }

    .article-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;
      margin-bottom: 1rem;
    }

    .article-source {
      font-size: 0.875rem;
      color: #3b82f6;
      font-weight: 500;
    }

    .article-date {
      font-size: 0.875rem;
      color: #666;
    }

    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .status-badge.scraped-v1 {
      background: #3b82f6;
      color: white;
    }

    .status-badge.scraped-v2 {
      background: #10b981;
      color: white;
    }

    .status-badge.not-available {
      background: #9ca3af;
      color: white;
    }

    .status-badge.pending {
      background: #fbbf24;
      color: #78350f;
    }

    .version-selector {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .version-button {
      padding: 0.5rem 1rem;
      border: 1px solid #e5e7eb;
      border-radius: 0.375rem;
      background: white;
      color: #374151;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .version-button:hover {
      background: #f3f4f6;
    }

    .version-button.active {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
    }

    .article-content {
      background: white;
      border-radius: 0.5rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .article-content h2 {
      font-size: 1.25rem;
      color: #1a1a1a;
      margin: 0 0 1rem 0;
    }

    .article-body {
      font-size: 1rem;
      line-height: 1.8;
      color: #374151;
    }

    .article-body p {
      margin-bottom: 1rem;
    }

    .article-body img {
      max-width: 100%;
      height: auto;
      border-radius: 0.25rem;
      margin: 1rem 0;
    }

    .comments-section {
      background: white;
      border-radius: 0.5rem;
      padding: 1.5rem;
    }

    .comments-title {
      font-size: 1.25rem;
      color: #1a1a1a;
      margin: 0 0 1rem 0;
    }

    .comment {
      padding: 1rem;
      border-bottom: 1px solid #e5e7eb;
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
      font-weight: 500;
      color: #1a1a1a;
    }

    .comment-date {
      font-size: 0.75rem;
      color: #9ca3af;
    }

    .comment-content {
      font-size: 0.875rem;
      color: #374151;
      line-height: 1.6;
    }

    .comment-footer {
      display: flex;
      gap: 1rem;
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: #9ca3af;
    }

    .loading {
      text-align: center;
      padding: 3rem;
      color: rgba(255, 255, 255, 0.8);
      font-size: 1.125rem;
    }

    .error {
      text-align: center;
      padding: 3rem;
      color: rgba(239, 68, 68, 0.9);
      font-size: 1.125rem;
    }

    .no-content {
      color: #9ca3af;
      font-style: italic;
    }

    .original-link {
      display: inline-block;
      margin-top: 1rem;
      color: #3b82f6;
      text-decoration: none;
      font-size: 0.875rem;
    }

    .original-link:hover {
      text-decoration: underline;
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

  render() {
    if (this.loading) {
      return html`
        <div class="container">
          <a href="/news" class="back-link">Back to News</a>
          <div class="loading">Loading article...</div>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="container">
          <a href="/news" class="back-link">Back to News</a>
          <div class="error">${this.error}</div>
        </div>
      `;
    }

    if (!this.article) {
      return html`
        <div class="container">
          <a href="/news" class="back-link">Back to News</a>
          <div class="error">Article not found</div>
        </div>
      `;
    }

    const currentVersion = this.getCurrentVersion();

    return html`
      <div class="container">
        <a href="/news" class="back-link">Back to News</a>

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
