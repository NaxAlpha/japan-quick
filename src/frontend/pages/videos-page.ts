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
import { getAuthHeaders } from '../lib/auth.js';
import { baseStyles, buttonStyles, badgeStyles, loadingStyles } from '../styles/shared-styles.js';
import { POLLING } from '../lib/constants.js';
import type { VideoFormat, RenderStatus, YouTubeUploadStatus } from '../types/video.js';

type VideoType = 'short' | 'long';
type VideoSelectionStatus = 'todo' | 'doing' | 'done';

interface ParsedVideo {
  id: number;
  notes: string[];
  short_title: string | null;
  articles: string[];
  video_type: VideoType;
  video_format: VideoFormat | null;
  selection_status: VideoSelectionStatus;
  script_status: 'pending' | 'generating' | 'generated' | 'error';
  asset_status: 'pending' | 'generating' | 'generated' | 'error';
  render_status: RenderStatus;
  youtube_upload_status: YouTubeUploadStatus;
  total_cost: number;
  created_at: string;
  updated_at: string;
}

@customElement('videos-page')
export class VideosPage extends LitElement {
  static styles = [baseStyles, buttonStyles, badgeStyles, loadingStyles, css`
    .container {
      max-width: 1200px;
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


    .header-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.75rem;
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
      flex-direction: column;
      gap: 0.75rem;
    }

    .video-title {
      font-family: 'Inter', sans-serif;
      font-size: 1rem;
      font-weight: 700;
      color: #0a0a0a;
      margin: 0;
      line-height: 1.4;
    }

    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      justify-content: flex-end;
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
      padding: 4rem 2rem;
      font-family: 'Inter', sans-serif;
      font-size: 1rem;
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
    }
  `];

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

  connectedCallback() {
    super.connectedCallback();
    this.loadVideos();
  }

  private async loadVideos(page: number = 1) {
    try {
      this.loading = true;
      this.error = null;

      const response = await fetch(`/api/videos?page=${page}`, {
        headers: getAuthHeaders()
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
          ...getAuthHeaders()
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setTimeout(() => {
          this.loadVideos();
        }, POLLING.VIDEOS_POLL_INTERVAL_MS);
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
        headers: getAuthHeaders()
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

  private formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  private getFormatBadge(video: ParsedVideo) {
    const format = video.video_format || video.video_type;
    const labels: Record<string, string> = {
      'single_short': 'SHORT',
      'multi_short': 'MULTI',
      'long': 'LONG',
      'short': 'SHORT'
    };
    const label = labels[format] || format.toUpperCase();
    const classes = `badge type-${video.video_type}`;
    return html`<span class="${classes}">${label}</span>`;
  }

  private getRenderStatusLabel(status: RenderStatus): string {
    const labels: Record<RenderStatus, string> = {
      'pending': 'WAIT',
      'rendering': 'RENDER...',
      'rendered': 'DONE',
      'error': 'FAIL'
    };
    return labels[status] || status;
  }

  private getYouTubeStatusLabel(status: YouTubeUploadStatus): string {
    const labels: Record<YouTubeUploadStatus, string> = {
      'pending': 'WAIT',
      'uploading': 'UP...',
      'processing': 'PROC.',
      'uploaded': 'DONE',
      'error': 'FAIL'
    };
    return labels[status] || status;
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
            ${this.getFormatBadge(video)}
            <span class="badge script-${video.script_status}">SCR: ${this.getStatusLabel(video.script_status)}</span>
            <span class="badge asset-${video.asset_status}">AST: ${this.getStatusLabel(video.asset_status)}</span>
            <span class="badge render-${video.render_status}">RND: ${this.getRenderStatusLabel(video.render_status)}</span>
            <span class="badge youtube-${video.youtube_upload_status}">YT: ${this.getYouTubeStatusLabel(video.youtube_upload_status)}</span>
          </div>
        </div>

        <div class="video-meta">
          <span>${this.formatDateTime(video.created_at)}</span>
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
