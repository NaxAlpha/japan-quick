/**
 * Videos page component - Video selection management
 * Displays AI-selected videos for generation
 * GET /api/videos to list videos
 * POST /api/videos/trigger to manually trigger workflow
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

type VideoType = 'short' | 'long';
type VideoSelectionStatus = 'todo' | 'doing' | 'done';

interface ParsedVideo {
  id: number;
  notes: string[];
  short_title: string | null;
  articles: string[];
  video_type: VideoType;
  selection_status: VideoSelectionStatus;
  total_cost: number;
  created_at: string;
  updated_at: string;
}

@customElement('videos-page')
export class VideosPage extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
    }

    .container {
      padding: 2rem;
      max-width: 1000px;
      margin: 0 auto;
    }

    h1 {
      color: white;
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
    }

    .trigger-button {
      padding: 0.75rem 1.5rem;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 0.5rem;
      color: white;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      margin-bottom: 1.5rem;
    }

    .trigger-button:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.3);
    }

    .trigger-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .videos-list {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .video-card {
      background: white;
      border-radius: 0.5rem;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .video-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .video-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0;
      flex: 1;
    }

    .badges {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;
    }

    .badge.status-todo {
      background: #fbbf24;
      color: #78350f;
    }

    .badge.status-doing {
      background: #3b82f6;
      color: white;
    }

    .badge.status-done {
      background: #10b981;
      color: white;
    }

    .badge.type-short {
      background: #8b5cf6;
      color: white;
    }

    .badge.type-long {
      background: #ec4899;
      color: white;
    }

    .video-meta {
      display: flex;
      gap: 1rem;
      color: #666;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .video-cost {
      font-weight: 600;
      color: #059669;
    }

    .video-articles {
      margin-bottom: 1rem;
    }

    .video-articles-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 0.5rem 0;
    }

    .article-links {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .article-link {
      padding: 0.25rem 0.75rem;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 0.25rem;
      color: #3b82f6;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: background 0.2s;
    }

    .article-link:hover {
      background: #e5e7eb;
    }

    .video-notes {
      margin-top: 1rem;
    }

    .video-notes-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 0.5rem 0;
    }

    .notes-list {
      list-style: disc;
      padding-left: 1.5rem;
      margin: 0;
    }

    .notes-list li {
      font-size: 0.875rem;
      color: #4b5563;
      margin-bottom: 0.25rem;
      line-height: 1.5;
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
  private videos: ParsedVideo[] = [];

  @state()
  private loading: boolean = true;

  @state()
  private error: string | null = null;

  @state()
  private triggering: boolean = false;

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
    this.loadVideos();
  }

  private async loadVideos() {
    try {
      this.loading = true;
      this.error = null;

      const response = await fetch('/api/videos', {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        this.videos = data.videos;
      } else {
        throw new Error(data.error || 'Failed to load videos');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load videos';
    } finally {
      this.loading = false;
    }
  }

  private async triggerWorkflow() {
    try {
      this.triggering = true;

      const response = await fetch('/api/videos/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        // Wait a few seconds then reload videos
        setTimeout(() => {
          this.loadVideos();
        }, 3000);
      } else {
        throw new Error(data.error || 'Failed to trigger workflow');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to trigger workflow';
    } finally {
      this.triggering = false;
    }
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private getStatusBadge(status: VideoSelectionStatus) {
    const classes = `badge status-${status}`;
    return html`<span class="${classes}">${status.toUpperCase()}</span>`;
  }

  private getTypeBadge(type: VideoType) {
    const classes = `badge type-${type}`;
    const label = type === 'short' ? 'Short (60-120s)' : 'Long (4-6min)';
    return html`<span class="${classes}">${label}</span>`;
  }

  render() {
    return html`
      <div class="container">
        <h1>Video Selections</h1>

        <button
          @click=${this.triggerWorkflow}
          ?disabled=${this.triggering}
          class="trigger-button"
        >
          ${this.triggering ? 'Triggering...' : 'Trigger Selection Workflow'}
        </button>

        ${this.renderContent()}

        <a href="/" class="home-link">Back to Home</a>
      </div>
    `;
  }

  private renderContent() {
    if (this.loading) {
      return html`<div class="status-message">Loading videos...</div>`;
    }

    if (this.error) {
      return html`<div class="status-message" style="color: rgba(239, 68, 68, 0.9)">Error: ${this.error}</div>`;
    }

    if (this.videos.length === 0) {
      return html`<div class="status-message">No videos found. Click "Trigger Selection Workflow" to start.</div>`;
    }

    return html`
      <div class="videos-list">
        ${this.videos.map(video => this.renderVideoCard(video))}
      </div>
    `;
  }

  private renderVideoCard(video: ParsedVideo) {
    return html`
      <div class="video-card">
        <div class="video-header">
          <h2 class="video-title">${video.short_title || 'Untitled Video'}</h2>
          <div class="badges">
            ${this.getStatusBadge(video.selection_status)}
            ${this.getTypeBadge(video.video_type)}
          </div>
        </div>

        <div class="video-meta">
          <span>${this.formatDate(video.created_at)}</span>
          <span class="video-cost">$${video.total_cost.toFixed(4)}</span>
        </div>

        ${video.articles.length > 0 ? html`
          <div class="video-articles">
            <p class="video-articles-title">Articles (${video.articles.length}):</p>
            <div class="article-links">
              ${video.articles.map(pickId => html`
                <a href="/article/pick:${pickId}" class="article-link">pick:${pickId}</a>
              `)}
            </div>
          </div>
        ` : ''}

        ${video.notes.length > 0 ? html`
          <div class="video-notes">
            <p class="video-notes-title">Selection Rationale:</p>
            <ul class="notes-list">
              ${video.notes.map(note => html`<li>${note}</li>`)}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  }
}
