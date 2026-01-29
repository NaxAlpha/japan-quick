/**
 * Video assets card component
 * Displays asset generation status, model selectors, and generated assets
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles, buttonStyles, badgeStyles, loadingStyles } from '../styles/shared-styles.js';
import type { ParsedVideo, AssetStatus, ImageModelId, TTSModelId } from '../types/video.js';

@customElement('video-assets-card')
export class VideoAssetsCard extends LitElement {
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

    .model-selectors {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .model-selector label {
      display: block;
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      font-weight: 400;
      color: #78746c;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 0.375rem;
    }

    .model-selector select {
      width: 100%;
      padding: 0.5rem 0.625rem;
      border: 2px solid #0a0a0a;
      background: #ffffff;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      color: #0a0a0a;
      cursor: pointer;
    }

    .grids-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }

    .grid-preview {
      border: 3px solid #0a0a0a;
      overflow: hidden;
      background: #f5f3f0;
      aspect-ratio: 16 / 9;
    }

    .grid-preview.portrait {
      aspect-ratio: 9 / 16;
    }

    .grid-preview img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .slides-audio-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .slide-audio-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem;
      background: #fafafa;
      border: 2px solid #e8e6e1;
    }

    .slide-image {
      width: 80px;
      height: 80px;
      object-fit: cover;
      border: 2px solid #0a0a0a;
      flex-shrink: 0;
      background: #f3f4f6;
    }

    .slide-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      min-width: 0;
    }

    .slide-content-title {
      font-family: 'Inter', sans-serif;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #0a0a0a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .slide-audio-player {
      width: 100%;
    }

    .slide-audio-player audio {
      width: 100%;
      height: 28px;
    }

    .voice-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      background: #e63946;
      color: #ffffff;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      border: 2px solid #e63946;
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
  generating = false;

  @property({ type: String })
  selectedImageModel: ImageModelId = 'gemini-2.5-flash-image';

  @property({ type: String })
  selectedTTSModel: TTSModelId = 'gemini-2.5-flash-preview-tts';

  willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('video') && this.video) {
      this.selectedImageModel = this.video.image_model;
      this.selectedTTSModel = this.video.tts_model;
    }
  }

  private getStatusLabel(status: AssetStatus): string {
    const labels: Record<AssetStatus, string> = {
      'pending': 'WAIT',
      'generating': 'GEN...',
      'generated': 'DONE',
      'error': 'FAIL'
    };
    return labels[status] || status;
  }

  private dispatchGenerate() {
    this.dispatchEvent(new CustomEvent('generate-assets', {
      detail: {
        image_model: this.selectedImageModel,
        tts_model: this.selectedTTSModel
      }
    }));
  }

  render() {
    if (!this.video) return null;

    const { asset_status, asset_error, assets, script, tts_voice, slideImageAssetIds, slideAudioAssetIds } = this.video;
    const hasAssets = assets && assets.length > 0;

    return html`
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Assets</h2>
          <span class="badge asset-${asset_status}">${this.getStatusLabel(asset_status)}</span>
        </div>
        <div class="card-body">
          ${asset_error && asset_status === 'error' ? html`
            <div class="error-message">[ ERROR: ${asset_error} ]</div>
          ` : ''}

          <div class="model-selectors">
            <div class="model-selector">
              <label>Image Model</label>
              <select
                @change=${(e: Event) => {
                  this.selectedImageModel = (e.target as HTMLSelectElement).value as ImageModelId;
                }}
                .value=${this.selectedImageModel}
                ?disabled=${asset_status === 'generating'}
              >
                <option value="gemini-2.5-flash-image">Flash ($0.039)</option>
                <option value="gemini-3-pro-image-preview">Pro ($0.134)</option>
              </select>
            </div>

            <div class="model-selector">
              <label>TTS Model</label>
              <select
                @change=${(e: Event) => {
                  this.selectedTTSModel = (e.target as HTMLSelectElement).value as TTSModelId;
                }}
                .value=${this.selectedTTSModel}
                ?disabled=${asset_status === 'generating'}
              >
                <option value="gemini-2.5-flash-preview-tts">Flash TTS</option>
                <option value="gemini-2.5-pro-preview-tts">Pro TTS</option>
              </select>
            </div>
          </div>

          ${asset_status === 'pending' || asset_status === 'error' ? html`
            <button
              class="btn btn-success"
              @click=${() => this.dispatchGenerate()}
              ?disabled=${this.generating}
            >
              ${this.generating ? html`<span class="loading-spinner"></span> Generating...` : '[ Generate Assets ]'}
            </button>
          ` : ''}

          ${asset_status === 'generating' ? html`
            <div class="loading-row">
              <span class="loading-spinner"></span>
              <span>Generating assets, please wait...</span>
            </div>
          ` : ''}

          ${asset_status === 'generated' && hasAssets ? html`
            <div style="margin-top: 1.5rem;">
              <button
                class="btn"
                @click=${() => this.dispatchGenerate()}
                ?disabled=${this.generating}
              >
                ${this.generating ? html`<span class="loading-spinner"></span> Regenerating...` : '[ Regenerate Assets ]'}
              </button>

              ${tts_voice ? html`
                <div style="margin-top: 0.75rem;">
                  <span class="voice-badge">🎙️ ${tts_voice}</span>
                </div>
              ` : ''}

              ${script && slideImageAssetIds && slideImageAssetIds.length > 0 ? html`
                <div style="margin-top: 1.5rem;">
                  <h4 style="font-family: 'Space Mono', monospace; font-size: 0.6875rem; color: #78746c; margin: 0 0 0.75rem 0; text-transform: uppercase;">Slide Images</h4>
                  <div class="slides-audio-list">
                    ${slideImageAssetIds.map((assetId: string, idx: number) => html`
                      <div class="slide-audio-item">
                        <img
                          class="slide-image"
                          src="https://japan-quick-assets.nauman.im/${assetId}.png"
                          alt="Slide ${idx + 1}"
                        />

                        <div class="slide-content">
                          <div class="slide-content-title">${script.slides[idx]?.headline || 'Slide ' + (idx + 1)}</div>
                          ${slideAudioAssetIds && slideAudioAssetIds[idx] ? html`
                            <div class="slide-audio-player">
                              <audio controls src="https://japan-quick-assets.nauman.im/${slideAudioAssetIds[idx]}.wav"></audio>
                            </div>
                          ` : ''}
                        </div>
                      </div>
                    `)}
                  </div>
                </div>
              ` : ''}

              ${assets && assets.filter(a => a.assetType === 'grid_image').length > 0 ? html`
                <div style="margin-top: 1.5rem;">
                  <h4 style="font-family: 'Space Mono', monospace; font-size: 0.6875rem; color: #78746c; margin: 0 0 0.75rem 0; text-transform: uppercase;">Grid Images</h4>
                  <div class="grids-container">
                    ${assets.filter(a => a.assetType === 'grid_image').map((asset, idx) => html`
                      <div class="grid-preview">
                        <img src="${asset.url}" alt="Grid ${idx}" />
                      </div>
                    `)}
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'video-assets-card': VideoAssetsCard;
  }
}
