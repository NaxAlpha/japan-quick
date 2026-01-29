/**
 * Video selection card component
 * Displays selected articles, notes, and short title
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/shared-styles.js';
import type { ParsedVideo } from '../types/video.js';

@customElement('video-selection-card')
export class VideoSelectionCard extends LitElement {
  static styles = [baseStyles, css`
    .card {
      background: #ffffff;
      border: 3px solid #0a0a0a;
      box-shadow: 4px 4px 0 #0a0a0a;
      width: 300px;
    }

    .card-header {
      padding: 1rem 1.25rem;
      border-bottom: 2px solid #e8e6e1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .card-title {
      font-family: 'Inter', sans-serif;
      font-size: 0.875rem;
      font-weight: 700;
      color: #0a0a0a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .card-body {
      padding: 1.25rem;
    }

    .notes-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .notes-list li {
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.5rem;
      background: #f5f3f0;
      border-left: 3px solid #e63946;
      font-family: 'Inter', sans-serif;
      font-size: 0.8125rem;
      color: #282420;
      line-height: 1.6;
    }

    .notes-list li:last-child {
      margin-bottom: 0;
    }

    .articles-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .article-link {
      display: flex;
      align-items: center;
      padding: 0.625rem 0.875rem;
      background: #ffffff;
      border: 2px solid #e8e6e1;
      color: #0a0a0a;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      text-decoration: none;
      transition: all 0.15s ease-out;
    }

    .article-link:hover {
      border-color: #e63946;
      background: #e63946;
      color: #ffffff;
    }
  `];

  @property({ type: Object })
  video: ParsedVideo | null = null;

  render() {
    if (!this.video) return null;

    return html`
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Selection</h2>
        </div>
        <div class="card-body">
          <div style="margin-bottom: 1rem;">
            <h3 style="font-family: 'Inter', sans-serif; font-size: 0.875rem; font-weight: 700; color: #0a0a0a; margin: 0 0 0.75rem 0;">${this.video.short_title || 'Untitled Video'}</h3>
          </div>

          ${this.video.notes.length > 0 ? html`
            <div style="margin-bottom: 1rem;">
              <h4 style="font-family: 'Space Mono', monospace; font-size: 0.6875rem; color: #78746c; margin: 0 0 0.5rem 0; text-transform: uppercase;">Notes</h4>
              <ul class="notes-list">
                ${this.video.notes.map(note => html`<li>${note}</li>`)}
              </ul>
            </div>
          ` : ''}

          ${this.video.articles.length > 0 ? html`
            <div>
              <h4 style="font-family: 'Space Mono', monospace; font-size: 0.6875rem; color: #78746c; margin: 0 0 0.5rem 0; text-transform: uppercase;">Articles</h4>
              <div class="articles-list">
                ${this.video.articles.map(pickId => html`
                  <a href="/article/pick:${pickId}" class="article-link">pick:${pickId}</a>
                `)}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'video-selection-card': VideoSelectionCard;
  }
}
