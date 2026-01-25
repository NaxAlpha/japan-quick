/**
 * Videos page component - Video selection management
 * Displays AI-selected videos for generation
 * GET /api/videos to list videos
 * POST /api/videos/trigger to manually trigger workflow
 *
 * Tokyo Editorial Cyber-Industrial aesthetic
 */

import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';

type VideoType = 'short' | 'long';
type VideoSelectionStatus = 'todo' | 'doing' | 'done';

interface ParsedVideo {
  id: number;
  notes: string[];
  short_title: string | null;
  articles: string[];
  video_type: VideoType;
  selection_status: VideoSelectionStatus;
  script_status: 'pending' | 'generating' | 'generated' | 'error';
  asset_status: 'pending' | 'generating' | 'generated' | 'error';
  total_cost: number;
  created_at: string;
  updated_at: string;
}

@customElement('videos-page')
export class VideosPage extends LitElement {
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
      max-width: 1200px;
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

    /* Header */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 2rem;
      position: relative;
      z-index: 1;
      flex-wrap: wrap;
    }

    .header-left {
      flex: 1;
      min-width: 280px;
    }

    .home-link {
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
      margin-bottom: 1.5rem;
    }

    .home-link:hover {
      background: #e63946;
      border-color: #e63946;
      transform: translate(-1px, -1px);
      box-shadow: 3px 3px 0 #0a0a0a;
    }

    h1 {
      font-family: 'Zen Tokyo Zoo', sans-serif;
      font-size: clamp(2rem, 6vw, 3.5rem);
      font-weight: 400;
      line-height: 1;
      color: #0a0a0a;
      margin: 0;
      text-transform: uppercase;
    }

    h1 .accent {
      color: #e63946;
    }

    .header-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.75rem;
    }

    /* Trigger button */
    .trigger-button {
      padding: 0.875rem 1.5rem;
      background: #e63946;
      color: #ffffff;
      border: 3px solid #e63946;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: all 0.15s ease-out;
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .trigger-button:hover:not(:disabled) {
      background: #0a0a0a;
      border-color: #0a0a0a;
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 #0a0a0a;
    }

    .trigger-button:focus-visible {
      outline: 3px solid #e63946;
      outline-offset: 3px;
    }

    .trigger-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .stats {
      display: flex;
      gap: 1rem;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      color: #58544c;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .stat-value {
      color: #e63946;
      font-weight: 700;
    }

    /* Videos list */
    .videos-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 1.5rem;
      position: relative;
      z-index: 1;
    }

    @media (max-width: 768px) {
      .videos-list {
        grid-template-columns: 1fr;
      }
    }

    .video-card {
      background: #ffffff;
      border: 3px solid #0a0a0a;
      cursor: pointer;
      transition: all 0.15s ease-out;
      box-shadow: 4px 4px 0 #0a0a0a;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .video-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: #e63946;
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.2s ease-out;
    }

    .video-card:hover {
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 #0a0a0a;
    }

    .video-card:hover::before {
      transform: scaleX(1);
    }

    .video-card:focus-visible {
      outline: 3px solid #e63946;
      outline-offset: 3px;
    }

    .video-card-header {
      padding: 1.25rem 1.25rem 0.75rem;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .video-title {
      font-family: 'Inter', sans-serif;
      font-size: 1rem;
      font-weight: 700;
      color: #0a0a0a;
      margin: 0;
      line-height: 1.4;
      flex: 1;
    }

    .badges {
      display: flex;
      gap: 0.375rem;
      flex-shrink: 0;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .badge {
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      font-weight: 400;
      padding: 0.25rem 0.5rem;
      border: 1px solid #0a0a0a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }

    .badge.type-short {
      background: #e63946;
      color: #ffffff;
      border-color: #e63946;
    }

    .badge.type-long {
      background: #0a0a0a;
      color: #ffffff;
      border-color: #0a0a0a;
    }

    .badge.script-pending,
    .badge.asset-pending {
      background: #f5f3f0;
      color: #58544c;
    }

    .badge.script-generating,
    .badge.asset-generating {
      background: #0066cc;
      color: #ffffff;
      border-color: #0066cc;
    }

    .badge.script-generated,
    .badge.asset-generated {
      background: #2d6a4f;
      color: #ffffff;
      border-color: #2d6a4f;
    }

    .badge.script-error,
    .badge.asset-error {
      background: #0a0a0a;
      color: #e63946;
      border-color: #e63946;
    }

    .video-meta {
      padding: 0 1.25rem 0.75rem;
      display: flex;
      gap: 1rem;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      color: #78746c;
    }

    .video-cost {
      color: #2d6a4f;
      font-weight: 700;
    }

    .video-footer {
      margin-top: auto;
      padding: 0.75rem 1.25rem;
      border-top: 2px solid #e8e6e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fafafa;
    }

    .video-id {
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      color: #a8a49c;
    }

    .delete-button {
      padding: 0.375rem 0.875rem;
      background: #ffffff;
      color: #e63946;
      border: 2px solid #e63946;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      transition: all 0.15s ease-out;
      box-shadow: 2px 2px 0 #e63946;
    }

    .delete-button:hover:not(:disabled) {
      background: #e63946;
      color: #ffffff;
      transform: translate(-1px, -1px);
      box-shadow: 3px 3px 0 #0a0a0a;
    }

    .delete-button:focus-visible {
      outline: 2px solid #e63946;
      outline-offset: 2px;
    }

    .delete-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Status messages */
    .status-message {
      text-align: center;
      padding: 4rem 2rem;
      font-family: 'Inter', sans-serif;
      font-size: 1rem;
      color: #58544c;
      position: relative;
      z-index: 1;
    }

    .status-message.error {
      color: #e63946;
    }

    /* Load more */
    .load-more-container {
      display: flex;
      justify-content: center;
      margin-top: 2rem;
      position: relative;
      z-index: 1;
    }

    .load-more-button {
      padding: 0.875rem 2rem;
      background: #0a0a0a;
      color: #ffffff;
      border: 3px solid #0a0a0a;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: all 0.15s ease-out;
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .load-more-button:hover:not(:disabled) {
      background: #e63946;
      border-color: #e63946;
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 #0a0a0a;
    }

    .load-more-button:focus-visible {
      outline: 3px solid #e63946;
      outline-offset: 3px;
    }

    .load-more-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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

  @state()
  currentPage = 1;

  @state()
  hasMore = false;

  @state()
  loadingMore = false;

  @property({ type: Object })
  deleting = new Set<number>();

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

  private async loadVideos(page: number = 1) {
    try {
      this.loading = true;
      this.error = null;

      const response = await fetch(`/api/videos?page=${page}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        if (page > 1) {
          this.videos = [...this.videos, ...data.videos];
        } else {
          this.videos = data.videos;
        }

        if (data.pagination) {
          this.currentPage = data.pagination.page;
          this.hasMore = data.pagination.hasMore;
        }
      } else {
        throw new Error(data.error || 'Failed to load videos');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load videos';
    } finally {
      this.loading = false;
    }
  }

  private async loadMoreVideos() {
    try {
      this.loadingMore = true;
      await this.loadVideos(this.currentPage + 1);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load more videos';
    } finally {
      this.loadingMore = false;
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

  private async deleteVideo(videoId: number) {
    if (!confirm('Delete this video? This action cannot be undone.')) {
      return;
    }

    try {
      this.deleting.add(videoId);
      this.requestUpdate();

      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        this.videos = this.videos.filter(v => v.id !== videoId);
        this.deleting.delete(videoId);
        this.requestUpdate();
      } else {
        throw new Error(data.error || 'Failed to delete video');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to delete video';
      this.deleting.delete(videoId);
      this.requestUpdate();
    }
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  private getTypeBadge(type: VideoType) {
    const classes = `badge type-${type}`;
    const label = type === 'short' ? 'SHORT' : 'LONG';
    return html`<span class="${classes}">${label}</span>`;
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'todo': 'READY',
      'doing': 'ACTIVE',
      'done': 'DONE',
      'pending': 'WAIT',
      'generating': 'GEN...',
      'generated': 'DONE',
      'error': 'FAIL'
    };
    return labels[status] || status;
  }

  render() {
    return html`
      <div class="container">
        <div class="header">
          <div class="header-left">
            <a href="/" class="home-link">← Home</a>
            <h1>Video<span class="accent">Queue</span></h1>
          </div>
          <div class="header-right">
            <button
              @click=${this.triggerWorkflow}
              ?disabled=${this.triggering}
              class="trigger-button"
            >
              ${this.triggering ? '[ TRIGGERING... ]' : '[ Trigger Workflow ]'}
            </button>
            ${this.videos.length > 0 ? html`
              <div class="stats">
                <div class="stat-item">
                  <span>TOTAL:</span>
                  <span class="stat-value">${this.videos.length}</span>
                </div>
                <div class="stat-item">
                  <span>SHORT:</span>
                  <span class="stat-value">${this.videos.filter(v => v.video_type === 'short').length}</span>
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        ${this.renderContent()}
      </div>
    `;
  }

  private renderContent() {
    if (this.loading) {
      return html`<div class="status-message">Loading videos...</div>`;
    }

    if (this.error && this.videos.length === 0) {
      return html`<div class="status-message error">[ ERROR: ${this.error} ]</div>`;
    }

    if (this.videos.length === 0) {
      return html`<div class="status-message">No videos. Click "Trigger Workflow" to start.</div>`;
    }

    return html`
      <div class="videos-list">
        ${this.videos.map(video => this.renderVideoCard(video))}
      </div>
      ${this.hasMore ? html`
        <div class="load-more-container">
          <button
            class="load-more-button"
            ?disabled=${this.loadingMore}
            @click=${this.loadMoreVideos}
          >
            ${this.loadingMore ? '[ LOADING... ]' : '[ Load More ]'}
          </button>
        </div>
      ` : ''}
    `;
  }

  private navigateToVideo(videoId: number): void {
    window.location.href = `/video/${videoId}`;
  }

  private renderVideoCard(video: ParsedVideo) {
    const isDeleting = this.deleting.has(video.id);

    return html`
      <div class="video-card" @click=${() => this.navigateToVideo(video.id)}>
        <div class="video-card-header">
          <h2 class="video-title">${video.short_title || 'Untitled Video'}</h2>
          <div class="badges">
            ${this.getTypeBadge(video.video_type)}
            <span class="badge script-${video.script_status}">SCR: ${this.getStatusLabel(video.script_status)}</span>
            <span class="badge asset-${video.asset_status}">AST: ${this.getStatusLabel(video.asset_status)}</span>
          </div>
        </div>

        <div class="video-meta">
          <span>${this.formatDate(video.created_at)}</span>
          <span class="video-cost">$${video.total_cost.toFixed(4)}</span>
        </div>

        <div class="video-footer">
          <span class="video-id">#${video.id}</span>
          <button
            class="delete-button"
            ?disabled=${isDeleting}
            @click=${(e: Event) => {
              e.stopPropagation();
              this.deleteVideo(video.id);
            }}
          >
            ${isDeleting ? '...' : 'DELETE'}
          </button>
        </div>
      </div>
    `;
  }
}
