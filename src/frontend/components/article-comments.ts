/**
 * Article comments component
 * Displays comments for the current article version
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles, loadingStyles } from '../styles/shared-styles.js';

@customElement('article-comments')
export class ArticleComments extends LitElement {
  static styles = [baseStyles, loadingStyles, css`
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

    @media (max-width: 640px) {
      .comments-section {
        padding: 1.5rem;
      }
    }
  `];

  @property({ type: Number })
  commentCount: number = 0;

  @property({ type: Array })
  comments: Array<{
    id: number;
    author?: string;
    content: string;
    postedAt?: string;
    likes: number;
    repliesCount: number;
  }> = [];

  render() {
    if (this.comments.length > 0) {
      return html`
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
      `;
    }

    return html`
      <div class="comments-section">
        <h2 class="comments-title">Comments</h2>
        <p class="no-content">No comments available</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'article-comments': ArticleComments;
  }
}
