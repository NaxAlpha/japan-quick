/**
 * Article header component
 * Displays article title, metadata (source, date, status), version selector, and original link
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles, buttonStyles, badgeStyles } from '../styles/shared-styles.js';

type ArticleStatus = 'pending' | 'not_available' | 'scraped_v1' | 'scraped_v2';

@customElement('article-header')
export class ArticleHeader extends LitElement {
  static styles = [baseStyles, buttonStyles, badgeStyles, css`
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

    @media (max-width: 640px) {
      .article-header {
        padding: 1.5rem;
      }

      .version-selector {
        flex-direction: column;
      }

      .version-button {
        width: 100%;
        text-align: center;
      }
    }
  `];

  @property({ type: String })
  articleId: string = '';

  @property({ type: String })
  pickId: string = '';

  @property({ type: String })
  title: string = '';

  @property({ type: String })
  source?: string;

  @property({ type: String })
  publishedAt?: string;

  @property({ type: String })
  articleUrl?: string;

  @property({ type: String })
  status: ArticleStatus = 'pending';

  @property({ type: Array })
  versions: Array<{ version: number; scrapedAt: string }> = [];

  @property({ type: Number })
  selectedVersion: number = 1;

  @property({ type: Boolean })
  isPolling: boolean = false;

  private handleVersionChange(version: number) {
    this.dispatchEvent(new CustomEvent('version-change', { detail: { version } }));
  }

  private getStatusBadge(): string {
    switch (this.status) {
      case 'scraped_v1':
        return 'scraped-v1';
      case 'scraped_v2':
        return 'scraped-v2';
      case 'not_available':
        return 'not-available';
      case 'pending':
        return 'pending';
      default:
        return '';
    }
  }

  render() {
    return html`
      <div class="article-header">
        <h1 class="article-title">${this.title || 'Untitled'}</h1>

        <div class="article-meta">
          ${this.source ? html`<span class="article-source">${this.source}</span>` : ''}
          ${this.publishedAt ? html`<span class="article-date">${this.publishedAt}</span>` : ''}
          ${this.getStatusBadge() ? html`<span class="badge ${this.getStatusBadge()}">${this.status}</span>` : ''}
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

        ${this.articleUrl ? html`
          <a href="${this.articleUrl}" target="_blank" rel="noopener noreferrer" class="original-link">
            View original on Yahoo
          </a>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'article-header': ArticleHeader;
  }
}
