/**
 * Video detail page component
 * Displays video metadata, selection details, and script generation
 * GET /api/videos/:id to fetch video
 * POST /api/videos/:id/generate-script to generate script
 *
 * Tokyo Editorial Cyber-Industrial aesthetic
 */

import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { getAuthHeaders } from '../lib/auth.js';
import { baseStyles, loadingStyles } from '../styles/shared-styles.js';
import { createPoller, type Poller } from '../lib/polling.js';
import '../components/video-metadata-card.js';
import '../components/video-selection-card.js';
import '../components/video-script-card.js';
import '../components/video-assets-card.js';
import '../components/video-render-card.js';
import '../components/video-youtube-upload-card.js';
import type {
  ParsedVideo,
  ImageModelId,
  TTSModelId,
  RenderStatus,
  YouTubeUploadStatus
} from '../types/video.js';
import { POLLING, STATUS, TERMINAL_STATES } from '../lib/constants.js';

@customElement('video-page')
export class VideoPage extends LitElement {
  static styles = [baseStyles, loadingStyles, css`
    .container {
      max-width: 1400px;
    }

    /* Header */
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 2rem;
      position: relative;
      z-index: 1;
      flex-wrap: wrap;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    /* Cards container */
    .cards-container {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 1.5rem;
      position: relative;
      z-index: 1;
    }

    .card.span-full {
      grid-column: span 12;
    }

    .card.span-8 {
      grid-column: span 8;
    }

    .card.span-6 {
      grid-column: span 6;
    }

    .card.span-4 {
      grid-column: span 4;
    }

    @media (max-width: 1024px) {
      .card.span-8,
      .card.span-6,
      .card.span-4 {
        grid-column: span 12;
      }
    }
  `];

  @property({ type: String })
  videoId = '';

  @state()
  private video: ParsedVideo | null = null;

  @state()
  private loading = true;

  @state()
  private error = '';

  @state()
  private generatingScript = false;

  @state()
  private generatingAssets = false;

  @state()
  private renderingVideo = false;

  @state()
  private renderStatus: RenderStatus = 'pending';

  @state()
  private uploadingToYouTube = false;

  @state()
  private youtubeUploadStatus: YouTubeUploadStatus = 'pending';

  // Pollers for async operations
  private scriptPoller: Poller | null = null;
  private assetPoller: Poller | null = null;
  private renderPoller: Poller | null = null;
  private youtubeUploadPoller: Poller | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.loadVideo();
  }

  disconnectedCallback(): void {
    this.scriptPoller?.stop();
    this.assetPoller?.stop();
    this.renderPoller?.stop();
    this.youtubeUploadPoller?.stop();
    super.disconnectedCallback();
  }

  private async loadVideo(): Promise<void> {
    this.loading = true;
    this.error = '';

    try {
      const response = await fetch(`/api/videos/${this.videoId}`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to load video: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        this.video = data.video;
      } else {
        this.error = data.error || 'Failed to load video';
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load video';
    } finally {
      this.loading = false;
    }
  }

  private async generateScript(): Promise<void> {
    if (!this.video) return;

    this.generatingScript = true;
    this.error = '';

    try {
      const response = await fetch(`/api/videos/${this.videoId}/generate-script`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to generate script: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        // Start polling for status
        this.startScriptPolling();
      } else {
        this.error = data.error || 'Failed to generate script';
        this.generatingScript = false;
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to generate script';
      this.generatingScript = false;
    }
  }

  private async generateAssets(detail: { image_model: ImageModelId; tts_model: TTSModelId }): Promise<void> {
    if (!this.video) return;

    this.generatingAssets = true;
    this.error = '';

    try {
      const response = await fetch(`/api/videos/${this.videoId}/generate-assets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(detail)
      });

      if (!response.ok) {
        throw new Error(`Failed to generate assets: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        // Start polling for status
        this.startAssetPolling();
      } else {
        this.error = data.error || 'Failed to generate assets';
        this.generatingAssets = false;
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to generate assets';
      this.generatingAssets = false;
    }
  }

  private async renderVideo(): Promise<void> {
    if (!this.video) return;

    this.renderingVideo = true;
    this.error = '';

    try {
      const response = await fetch(`/api/videos/${this.videoId}/render`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to start render: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        // Start polling for render status
        this.startRenderPolling();
      } else {
        this.error = data.error || 'Failed to start render';
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to start render';
      this.renderingVideo = false;
    }
  }

  private startScriptPolling(): void {
    this.scriptPoller = createPoller({
      getEndpoint: () => `/api/videos/${this.videoId}/script/status`,
      intervalMs: POLLING.SCRIPT_POLL_INTERVAL_MS,
      terminalStates: TERMINAL_STATES.SCRIPT,
      onStatus: (status, data) => {
        if (status === STATUS.SCRIPT.ERROR) {
          this.error = (data as { error?: string }).error || 'Script generation failed';
        }
      },
      onComplete: async (terminalStatus) => {
        this.generatingScript = false;
        if (terminalStatus === STATUS.SCRIPT.GENERATED) {
          await this.loadVideo();
        }
        // For error status, the error was already set in onStatus callback
      },
      onError: (err) => {
        console.error('Script polling error:', err);
        this.generatingScript = false;
      }
    });

    this.scriptPoller.start();
  }

  private startAssetPolling(): void {
    this.assetPoller = createPoller({
      getEndpoint: () => `/api/videos/${this.videoId}/assets/status`,
      intervalMs: POLLING.ASSET_POLL_INTERVAL_MS,
      terminalStates: TERMINAL_STATES.ASSET,
      onStatus: (status, data) => {
        if (status === STATUS.ASSET.ERROR) {
          this.error = (data as { error?: string }).error || 'Asset generation failed';
        }
      },
      onComplete: async (terminalStatus) => {
        this.generatingAssets = false;
        if (terminalStatus === STATUS.ASSET.GENERATED) {
          await this.loadVideo();
        }
        // For error status, the error was already set in onStatus callback
      },
      onError: (err) => {
        console.error('Asset polling error:', err);
        this.generatingAssets = false;
      }
    });

    this.assetPoller.start();
  }

  private startRenderPolling(): void {
    this.renderPoller = createPoller({
      getEndpoint: () => `/api/videos/${this.videoId}/render/status`,
      intervalMs: POLLING.RENDER_POLL_INTERVAL_MS,
      terminalStates: TERMINAL_STATES.RENDER,
      onStatus: (status, data) => {
        this.renderStatus = status as RenderStatus;
        if (status === STATUS.RENDER.ERROR) {
          this.error = (data as { renderError?: string }).renderError || 'Render failed';
        }
      },
      onComplete: async (terminalStatus) => {
        this.renderingVideo = false;
        if (terminalStatus === STATUS.RENDER.RENDERED) {
          await this.loadVideo();
        }
        // For error status, the error was already set in onStatus callback
      },
      onError: (err) => {
        console.error('Render polling error:', err);
        this.renderingVideo = false;
      }
    });

    this.renderPoller.start();
  }

  private async uploadToYouTube(): Promise<void> {
    if (!this.video) return;

    this.uploadingToYouTube = true;
    this.error = '';

    try {
      const response = await fetch(`/api/videos/${this.videoId}/youtube-upload`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to start YouTube upload: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        // Start polling for upload status
        this.startYouTubeUploadPolling();
      } else {
        this.error = data.error || 'Failed to start YouTube upload';
        this.uploadingToYouTube = false;
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to start YouTube upload';
      this.uploadingToYouTube = false;
    }
  }

  private startYouTubeUploadPolling(): void {
    this.youtubeUploadPoller = createPoller({
      getEndpoint: () => `/api/videos/${this.videoId}/youtube-upload/status`,
      intervalMs: POLLING.YOUTUBE_UPLOAD_POLL_INTERVAL_MS,
      terminalStates: TERMINAL_STATES.YOUTUBE_UPLOAD,
      onStatus: (status, data) => {
        this.youtubeUploadStatus = status as YouTubeUploadStatus;
        if (status === 'error') {
          this.error = (data as { uploadError?: string }).uploadError || 'YouTube upload failed';
        }
      },
      onComplete: async (terminalStatus) => {
        this.uploadingToYouTube = false;
        if (terminalStatus === 'uploaded') {
          await this.loadVideo();
        }
        // For error status, the error was already set in onStatus callback
      },
      onError: (err) => {
        console.error('YouTube upload polling error:', err);
        this.uploadingToYouTube = false;
      }
    });

    this.youtubeUploadPoller.start();
  }

  render() {
    if (this.loading) {
      return html`
        <div class="container">
          <div class="loading-row">
            <span class="loading-spinner"></span>
            <span>Loading video data...</span>
          </div>
        </div>
      `;
    }

    if (this.error && !this.video) {
      return html`
        <div class="container">
          <div class="error-message">[ ERROR: ${this.error} ]</div>
          <a href="/videos" class="back-link">← Back to Videos</a>
        </div>
      `;
    }

    return html`
      <div class="container">
        <div class="page-header">
          <div class="header-left">
            <a href="/videos" class="back-link">← Videos</a>
            <h1>Video<span class="accent">#${this.video?.id || ''}</span></h1>
          </div>
        </div>

        <div class="cards-container">
          <video-metadata-card .video=${this.video}></video-metadata-card>
          <video-selection-card .video=${this.video}></video-selection-card>
          <video-script-card
            .video=${this.video}
            .generating=${this.generatingScript}
            @generate-script=${this.generateScript}>
          </video-script-card>
          ${this.video && this.video.script_status === 'generated' ? html`
            <video-assets-card
              .video=${this.video}
              .generating=${this.generatingAssets}
              @generate-assets=${(e: CustomEvent) => this.generateAssets(e.detail)}>
            </video-assets-card>
          ` : ''}
          ${this.video && this.video.asset_status === 'generated' ? html`
            <video-render-card
              .video=${this.video}
              .rendering=${this.renderingVideo}
              @render-video=${this.renderVideo}>
            </video-render-card>
          ` : ''}
          ${this.video && this.video.render_status === 'rendered' ? html`
            <video-youtube-upload-card
              .video=${this.video}
              .uploading=${this.uploadingToYouTube}
              @upload-to-youtube=${this.uploadToYouTube}>
            </video-youtube-upload-card>
          ` : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'video-page': VideoPage;
  }
}
