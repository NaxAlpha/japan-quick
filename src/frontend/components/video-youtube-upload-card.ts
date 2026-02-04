/**
 * Video YouTube upload card component
 * Displays YouTube upload status and controls
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles, buttonStyles, badgeStyles, loadingStyles } from '../styles/shared-styles.js';
import type { ParsedVideo, YouTubeUploadStatus, YouTubeInfo } from '../types/video.js';

@customElement('video-youtube-upload-card')
export class VideoYouTubeUploadCard extends LitElement {
  static styles = [baseStyles, buttonStyles, badgeStyles, loadingStyles, css`
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

    .youtube-info {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .info-label {
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      font-weight: 400;
      color: #78746c;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      min-width: 60px;
    }

    .info-value {
      font-family: 'Inter', sans-serif;
      font-size: 0.875rem;
      font-weight: 600;
      color: #0a0a0a;
      word-break: break-all;
    }

    .youtube-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #ff0000;
      color: #ffffff;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      border: 2px solid #ff0000;
      text-decoration: none;
      transition: all 0.15s ease-out;
      box-shadow: 2px 2px 0 #0a0a0a;
      margin-top: 0.5rem;
    }

    .youtube-link:hover {
      background: #0a0a0a;
      border-color: #0a0a0a;
      transform: translate(-1px, -1px);
      box-shadow: 3px 3px 0 #0a0a0a;
    }

    .loading-spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid #e8e6e1;
      border-top-color: #e63946;
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      margin-top: 0.25rem;
    }

    .tag {
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      padding: 0.125rem 0.375rem;
      background: #f5f3f0;
      color: #58544c;
      border: 1px solid #e8e6e1;
    }
  `];

  @property({ type: Object })
  video: ParsedVideo | null = null;

  @property({ type: Boolean })
  uploading = false;

  private getYouTubeUploadStatusLabel(status: YouTubeUploadStatus): string {
    const labels: Record<YouTubeUploadStatus, string> = {
      'pending': 'WAIT',
      'uploading': 'UPLOAD...',
      'processing': 'PROCESS...',
      'uploaded': 'LIVE',
      'error': 'FAIL'
    };
    return labels[status] || status;
  }

  private dispatchUpload() {
    this.dispatchEvent(new CustomEvent('upload-to-youtube'));
  }

  private formatDateTime(dateString: string): string {
    // SQLite datetime('now') returns UTC as "YYYY-MM-DD HH:MM:SS"
    // Convert to ISO 8601 UTC format by replacing space with 'T' and adding 'Z'
    const utcString = dateString.replace(' ', 'T') + 'Z';
    const date = new Date(utcString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Tokyo'
    });
  }

  render() {
    if (!this.video) return null;

    const { youtube_upload_status, youtube_upload_error, youtubeInfo } = this.video;

    return html`
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">YouTube Upload</h2>
          <span class="badge youtube-${youtube_upload_status}">${this.getYouTubeUploadStatusLabel(youtube_upload_status)}</span>
        </div>
        <div class="card-body">
          ${youtube_upload_error && youtube_upload_status === 'error' ? html`
            <div class="error-message">[ ERROR: ${youtube_upload_error} ]</div>
          ` : ''}

          ${youtube_upload_status === 'pending' || youtube_upload_status === 'error' ? html`
            <p style="font-family: 'Inter', sans-serif; font-size: 0.875rem; color: #58544c; margin: 0 0 1rem 0;">
              Upload the rendered video to YouTube with automatic metadata.
            </p>
            <button
              class="btn btn-primary"
              @click=${() => this.dispatchUpload()}
              ?disabled=${this.uploading}
            >
              ${this.uploading ? html`<span class="loading-spinner"></span> Starting upload...` : '[ Upload to YouTube ]'}
            </button>
          ` : ''}

          ${youtube_upload_status === 'uploading' ? html`
            <div class="loading-row">
              <span class="loading-spinner"></span>
              <span>Uploading video to YouTube...</span>
            </div>
            <p style="font-family: 'Space Mono', monospace; font-size: 0.75rem; color: #78746c; margin: 0.5rem 0 0 0;">
              This may take several minutes depending on video size.
            </p>
          ` : ''}

          ${youtube_upload_status === 'processing' ? html`
            <div class="loading-row">
              <span class="loading-spinner"></span>
              <span>YouTube is processing your video...</span>
            </div>
            <p style="font-family: 'Space Mono', monospace; font-size: 0.75rem; color: #78746c; margin: 0.5rem 0 0 0;">
              Video will be available once processing completes.
            </p>
          ` : ''}

          ${youtube_upload_status === 'uploaded' && youtubeInfo ? html`
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.5rem;">▶️</span>
                <span style="font-family: 'Inter', sans-serif; font-size: 0.875rem; font-weight: 700; color: #2d6a4f;">
                  Video uploaded successfully!
                </span>
              </div>
              <div class="youtube-info">
                <div class="info-row">
                  <span class="info-label">Video ID</span>
                  <span class="info-value">${youtubeInfo.youtube_video_id}</span>
                </div>
                ${youtubeInfo.title ? html`
                  <div class="info-row">
                    <span class="info-label">Title</span>
                    <span class="info-value">${youtubeInfo.title}</span>
                  </div>
                ` : ''}
                <div class="info-row">
                  <span class="info-label">Privacy</span>
                  <span class="info-value">${youtubeInfo.privacy_status}</span>
                </div>
                ${youtubeInfo.upload_completed_at ? html`
                  <div class="info-row">
                    <span class="info-label">Uploaded</span>
                    <span class="info-value">${this.formatDateTime(youtubeInfo.upload_completed_at)}</span>
                  </div>
                ` : ''}
                ${youtubeInfo.tags ? html`
                  <div class="info-row">
                    <span class="info-label">Tags</span>
                    <div class="tags">
                      ${(JSON.parse(youtubeInfo.tags) as string[]).map(tag => html`
                        <span class="tag">${tag}</span>
                      `)}
                    </div>
                  </div>
                ` : ''}
                <a href="${youtubeInfo.youtube_video_url}" target="_blank" rel="noopener noreferrer" class="youtube-link">
                  ▶ Watch on YouTube
                </a>
              </div>
              <button
                class="btn"
                @click=${() => this.dispatchUpload()}
                ?disabled=${this.uploading}
                style="margin-top: 1rem;"
              >
                ${this.uploading ? html`<span class="loading-spinner"></span> Re-uploading...` : '[ Re-upload ]'}
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'video-youtube-upload-card': VideoYouTubeUploadCard;
  }
}
