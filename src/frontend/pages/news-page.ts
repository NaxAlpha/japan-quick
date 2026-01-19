/**
 * News page component
 * Displays Yahoo News Japan top picks with thumbnails, titles, and timestamps
 * List format with thumbnail on the right
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

interface YahooNewsTopPick {
  title: string;
  url: string;
  thumbnailUrl?: string;
  publishedAt?: string;
}

type FetchState = 'not-fetched' | 'fetching' | 'fetched';

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

    .news-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
      line-height: 1.4;
      color: #1a1a1a;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
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
  `;

  @state()
  private topPicks: YahooNewsTopPick[] = [];

  @state()
  private fetchState: FetchState = 'not-fetched';

  @state()
  private error: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    // Don't auto-fetch - start in not-fetched state
  }

  private async fetchNews() {
    this.fetchState = 'fetching';
    this.error = null;

    try {
      const response = await fetch('/api/news/yahoo-japan');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      this.topPicks = data.topPicks || [];
      this.fetchState = 'fetched';
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch news';
      this.topPicks = [];
      this.fetchState = 'not-fetched';
    }
  }

  render() {
    return html`
      <div class="container">
        <h1>Fetch Latest Top News</h1>

        <button
          @click=${this.fetchNews}
          ?disabled=${this.fetchState === 'fetching'}
          class="scrape-button"
        >
          ${this.fetchState === 'fetching' ? 'Fetching...' : 'Scrape News'}
        </button>

        ${this.renderContent()}

        <a href="/" class="home-link">Back to Home</a>
      </div>
    `;
  }

  private renderContent() {
    if (this.fetchState === 'not-fetched') {
      return html`<div class="status-message">Not Fetched</div>`;
    }

    if (this.fetchState === 'fetching') {
      return html`<div class="status-message">Fetching...</div>`;
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
            <a href="${topPick.url}" target="_blank" rel="noopener noreferrer" class="news-item">
              <div class="news-item-content">
                <h3 class="news-title">${topPick.title}</h3>
                ${topPick.publishedAt ? html`<p class="news-date">${topPick.publishedAt}</p>` : ''}
              </div>
              ${topPick.thumbnailUrl
                ? html`<img class="news-thumbnail" src="${topPick.thumbnailUrl}" alt="" />`
                : html`<div class="news-placeholder-thumbnail">📰</div>`}
            </a>
          `
        )}
      </div>
    `;
  }
}
