/**
 * Video render card component
 * Displays render status, rendered video player, and metadata
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles, buttonStyles, badgeStyles, loadingStyles } from '../styles/shared-styles.js';
import type { ParsedVideo, RenderStatus, RenderedVideoMetadata, GridImageMetadata, SlideAudioMetadata } from '../types/video.js';

@customElement('video-render-card')
export class VideoRenderCard extends LitElement {
  static styles = [baseStyles, buttonStyles, badgeStyles, loadingStyles, css`
    .card {
      background: #ffffff;
      border: 3px solid #0a0a0a;
      box-shadow: 4px 4px 0 #0a0a0a;
      grid-column: span 12;
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

    .rendered-video-player {
      width: 100%;
      max-width: 600px;
      border: 3px solid #0a0a0a;
      background: #000;
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .rendered-video-player video {
      width: 100%;
      display: block;
    }

    .download-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #0a0a0a;
      color: #ffffff;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      border: 2px solid #0a0a0a;
      text-decoration: none;
      transition: all 0.15s ease-out;
      box-shadow: 2px 2px 0 #0a0a0a;
    }

    .download-link:hover {
      background: #e63946;
      border-color: #e63946;
      transform: translate(-1px, -1px);
      box-shadow: 3px 3px 0 #0a0a0a;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .meta-label {
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      font-weight: 400;
      color: #78746c;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .meta-value {
      font-family: 'Inter', sans-serif;
      font-size: 0.875rem;
      font-weight: 600;
      color: #0a0a0a;
    }

    .loading-spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid #e8e6e1;
      border-top-color: #e63946;
    }
  `];

  @property({ type: Object })
  video: ParsedVideo | null = null;

  @property({ type: Boolean })
  rendering = false;

  private getRenderStatusLabel(status: RenderStatus): string {
    const labels: Record<RenderStatus, string> = {
      'pending': 'WAIT',
      'rendering': 'RENDER...',
      'rendered': 'DONE',
      'error': 'FAIL'
    };
    return labels[status] || status;
  }

  private getRenderMetadata(metadata: RenderedVideoMetadata | null): RenderedVideoMetadata | null {
    if (!metadata) return null;
    // Verify it's actually RenderedVideoMetadata by checking for required properties
    if ('fps' in metadata && 'durationMs' in metadata && 'videoCodec' in metadata) {
      return metadata;
    }
    return null;
  }

  private extractRenderMetadata(metadata: GridImageMetadata | SlideAudioMetadata | RenderedVideoMetadata | null): RenderedVideoMetadata | null {
    if (!metadata) return null;
    // Check if it's RenderedVideoMetadata by looking for required properties
    if ('fps' in metadata && 'durationMs' in metadata && 'videoCodec' in metadata) {
      return metadata as RenderedVideoMetadata;
    }
    return null;
  }

  private dispatchRender() {
    this.dispatchEvent(new CustomEvent('render-video'));
  }

  render() {
    if (!this.video) return null;

    const { render_status, render_error, renderedVideo } = this.video;

    return html`
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Rendered Video</h2>
          <span class="badge render-${render_status}">${this.getRenderStatusLabel(render_status)}</span>
        </div>
        <div class="card-body">
          ${render_error && render_status === 'error' ? html`
            <div class="error-message">[ ERROR: ${render_error} ]</div>
          ` : ''}

          ${render_status === 'pending' || render_status === 'error' ? html`
            <p style="font-family: 'Inter', sans-serif; font-size: 0.875rem; color: #58544c; margin: 0 0 1rem 0;">
              Render the final video with transitions, effects, and audio.
            </p>
            <button
              class="btn btn-primary"
              @click=${() => this.dispatchRender()}
              ?disabled=${this.rendering}
            >
              ${this.rendering ? html`<span class="loading-spinner"></span> Starting render...` : '[ Render Video ]'}
            </button>
          ` : ''}

          ${render_status === 'rendering' ? html`
            <div class="loading-row">
              <span class="loading-spinner"></span>
              <span>Rendering video, please wait...</span>
            </div>
            <p style="font-family: 'Space Mono', monospace; font-size: 0.75rem; color: #78746c; margin: 0.5rem 0 0 0;">
              This may take several minutes depending on video length.
            </p>
          ` : ''}

          ${render_status === 'rendered' && renderedVideo ? html`
            <div style="display: flex; flex-direction: column; gap: 1rem; align-items: center;">
              <div class="rendered-video-player">
                <video controls preload="metadata">
                  <source src="${renderedVideo.url}" type="video/webm">
                  Your browser does not support the video tag.
                </video>
              </div>
              <a href="${renderedVideo.url}" download="video_${this.video.id}.webm" class="download-link">
                ⬇ Download Video
              </a>
              ${renderedVideo.metadata ? html`
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.5rem; width: 100%; max-width: 600px;">
                  <div class="meta-item">
                    <span class="meta-label">Resolution</span>
                    <span class="meta-value">${this.extractRenderMetadata(renderedVideo.metadata)?.width || 0}x${this.extractRenderMetadata(renderedVideo.metadata)?.height || 0}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Duration</span>
                    <span class="meta-value">${((this.extractRenderMetadata(renderedVideo.metadata)?.durationMs || 0) / 1000).toFixed(1)}s</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">FPS</span>
                    <span class="meta-value">${this.extractRenderMetadata(renderedVideo.metadata)?.fps || 0}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Size</span>
                    <span class="meta-value">${((renderedVideo.fileSize || 0) / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>
              ` : ''}
              <button
                class="btn"
                @click=${() => this.dispatchRender()}
                ?disabled=${this.rendering}
              >
                ${this.rendering ? html`<span class="loading-spinner"></span> Re-rendering...` : '[ Re-render Video ]'}
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
    'video-render-card': VideoRenderCard;
  }
}
