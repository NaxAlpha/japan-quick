/**
 * Article content component
 * Displays scraped article content with version selector support
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { baseStyles, loadingStyles } from '../styles/shared-styles.js';

type ArticleStatus = 'pending' | 'not_available' | 'scraped_v1' | 'scraped_v2';

@customElement('article-content')
export class ArticleContent extends LitElement {
  static styles = [baseStyles, loadingStyles, css`
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

    @media (max-width: 640px) {
      .article-content {
        padding: 1.5rem;
      }
    }
  `];

  @property({ type: String })
  status: ArticleStatus = 'pending';

  @property({ type: Object })
  version: {
    id: number;
    articleId: number;
    version: number;
    content: string;
    contentText?: string;
    pageCount: number;
    images?: string;
    scrapedAt: string;
  } | null = null;

  render() {
    const isUnscraped = ['pending', 'not_available', 'retry_1', 'retry_2', 'error'].includes(this.status);

    return html`
      ${isUnscraped ? html`
        <div class="article-content">
          <h2>Content</h2>
          <p class="no-content">No content available. Article needs to be scraped first.</p>
        </div>
      ` : ''}

      ${!isUnscraped && this.version ? html`
        <div class="article-content">
          <h2>Content</h2>
          <div class="article-body">
            ${this.version.content ? unsafeHTML(this.version.content) : html`<p class="no-content">No content available</p>`}
          </div>
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'article-content': ArticleContent;
  }
}
