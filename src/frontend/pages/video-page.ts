/**
 * Video detail page component
 * Displays video metadata, selection details, and script generation
 * GET /api/videos/:id to fetch video
 * POST /api/videos/:id/generate-script to generate script
 */

import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import type {
  ParsedVideo,
  ImageModelId,
  TTSModelId,
  GridImageMetadata,
  SlideAudioMetadata
} from '../types/video.js';

@customElement('video-page')
export class VideoPage extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
    }

    .container {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .back-link {
      display: inline-block;
      margin-bottom: 1.5rem;
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

    .back-link:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .cards-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .card {
      background: white;
      border-radius: 0.5rem;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .card-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 1rem 0;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .meta-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: #666;
      text-transform: uppercase;
    }

    .meta-value {
      font-size: 1rem;
      color: #1a1a1a;
    }

    .badges {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;
    }

    .badge.type-short {
      background: #8b5cf6;
      color: white;
    }

    .badge.type-long {
      background: #ec4899;
      color: white;
    }

    .badge.selection-todo {
      background: #fbbf24;
      color: #78350f;
    }

    .badge.selection-doing {
      background: #3b82f6;
      color: white;
    }

    .badge.selection-done {
      background: #10b981;
      color: white;
    }

    .badge.selection-error {
      background: #ef4444;
      color: white;
    }

    .badge.script-pending {
      background: #e5e7eb;
      color: #374151;
    }

    .badge.script-generating {
      background: #3b82f6;
      color: white;
    }

    .badge.script-generated {
      background: #10b981;
      color: white;
    }

    .badge.script-error {
      background: #ef4444;
      color: white;
    }

    .notes-list {
      list-style: disc;
      padding-left: 1.5rem;
      margin: 0;
    }

    .notes-list li {
      margin-bottom: 0.5rem;
      color: #374151;
      line-height: 1.6;
    }

    .articles-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .article-link {
      color: #3b82f6;
      text-decoration: none;
      font-size: 0.875rem;
      padding: 0.5rem;
      border: 1px solid #e5e7eb;
      border-radius: 0.25rem;
      transition: all 0.2s;
    }

    .article-link:hover {
      background: #f3f4f6;
      border-color: #3b82f6;
    }

    .script-button {
      padding: 0.75rem 1.5rem;
      background: #3b82f6;
      border: none;
      border-radius: 0.5rem;
      color: white;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      margin-top: 1rem;
    }

    .script-button:hover:not(:disabled) {
      background: #2563eb;
    }

    .script-button:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }

    .script-button.retry {
      background: #f59e0b;
    }

    .script-button.retry:hover:not(:disabled) {
      background: #d97706;
    }

    .error-message {
      padding: 1rem;
      background: #fee2e2;
      border: 1px solid #fecaca;
      border-radius: 0.375rem;
      color: #991b1b;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .loading-spinner {
      display: inline-block;
      width: 1.5rem;
      height: 1.5rem;
      border: 3px solid #e5e7eb;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .script-hero {
      margin-bottom: 2rem;
      padding-bottom: 2rem;
      border-bottom: 2px solid #e5e7eb;
    }

    .script-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1a1a1a;
      line-height: 1.3;
      margin-bottom: 0.75rem;
    }

    .script-description {
      font-size: 0.875rem;
      color: #4b5563;
      line-height: 1.7;
      margin-bottom: 1rem;
    }

    .script-thumbnail {
      background: #f9fafb;
      border-left: 3px solid #3b82f6;
      padding: 0.75rem 1rem;
      border-radius: 0.25rem;
      font-size: 0.8125rem;
      color: #374151;
      font-style: italic;
      line-height: 1.6;
    }

    .slides-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.25rem;
      margin-top: 1.5rem;
    }

    .slide-card {
      background: #fafbfc;
      border-radius: 0.5rem;
      padding: 1.25rem;
      border: 1px solid #e5e7eb;
      position: relative;
      transition: all 0.2s;
    }

    .slide-card:hover {
      border-color: #cbd5e1;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .slide-number {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      background: #3b82f6;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .slide-headline {
      font-size: 1rem;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 0.875rem;
      padding-right: 2.5rem;
      line-height: 1.4;
    }

    .slide-section {
      margin-bottom: 0.875rem;
    }

    .slide-section:last-child {
      margin-bottom: 0;
    }

    .slide-narration {
      font-size: 0.8125rem;
      color: #374151;
      line-height: 1.7;
      padding: 0.625rem 0.875rem;
      background: white;
      border-radius: 0.375rem;
      border: 1px solid #e5e7eb;
    }

    .slide-image-desc {
      font-size: 0.75rem;
      color: #6b7280;
      line-height: 1.6;
      padding-left: 0.875rem;
      border-left: 2px solid #d1d5db;
      font-style: italic;
    }

    .slide-duration {
      display: inline-block;
      font-size: 0.6875rem;
      color: #6b7280;
      background: #f3f4f6;
      padding: 0.25rem 0.625rem;
      border-radius: 0.25rem;
      font-weight: 500;
      margin-top: 0.5rem;
    }

    .slides-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .slides-count {
      font-size: 0.8125rem;
      color: #6b7280;
      font-weight: 500;
    }

    /* Video Assets Card Styles */
    .assets-card {
      background: white;
      border-radius: 0.5rem;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .model-selectors {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .model-selector {
      flex: 1;
      min-width: 200px;
    }

    .model-selector label {
      display: block;
      font-size: 0.75rem;
      font-weight: 500;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 0.25rem;
    }

    .model-selector select {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #e5e7eb;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      color: #1a1a1a;
      background: white;
    }

    .asset-button {
      padding: 0.75rem 1.5rem;
      background: #10b981;
      border: none;
      border-radius: 0.5rem;
      color: white;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      margin-top: 1rem;
    }

    .asset-button:hover:not(:disabled) {
      background: #059669;
    }

    .asset-button:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }

    .badge.asset-pending {
      background: #e5e7eb;
      color: #374151;
    }

    .badge.asset-generating {
      background: #3b82f6;
      color: white;
    }

    .badge.asset-generated {
      background: #10b981;
      color: white;
    }

    .badge.asset-error {
      background: #ef4444;
      color: white;
    }

    .grids-container {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      margin-top: 1.5rem;
    }

    .grid-preview {
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      overflow: hidden;
    }

    .grid-preview img {
      display: block;
      max-width: 300px;
      height: auto;
    }

    .slides-audio-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 1.5rem;
    }

    .slide-audio-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: #fafbfc;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
    }

    .slide-crop {
      width: 60px;
      height: 60px;
      overflow: hidden;
      position: relative;
      border-radius: 0.375rem;
      flex-shrink: 0;
      background: #f3f4f6;
    }

    .slide-crop img {
      width: 180px;
      height: 180px;
      position: absolute;
    }

    .slide-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .slide-audio-player {
      width: 100%;
    }

    .slide-audio-player audio {
      width: 100%;
      height: 32px;
    }
  `;

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
  private selectedImageModel: ImageModelId = 'gemini-2.5-flash-image';

  @state()
  private selectedTTSModel: TTSModelId = 'gemini-2.5-flash-preview-tts';

  connectedCallback(): void {
    super.connectedCallback();
    this.loadVideo();
  }

  updated(changedProperties: Map<string, unknown>): void {
    super.updated(changedProperties);
    if (changedProperties.has('video') && this.video) {
      this.selectedImageModel = this.video.image_model;
      this.selectedTTSModel = this.video.tts_model;
    }
  }

  private async loadVideo(): Promise<void> {
    this.loading = true;
    this.error = '';

    try {
      const username = 'admin';
      const password = 'GvkP525fTX0ocMTw8XtAqM9ECvNIx50v';
      const credentials = btoa(`${username}:${password}`);

      const response = await fetch(`/api/videos/${this.videoId}`, {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
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
      const username = 'admin';
      const password = 'GvkP525fTX0ocMTw8XtAqM9ECvNIx50v';
      const credentials = btoa(`${username}:${password}`);

      const response = await fetch(`/api/videos/${this.videoId}/generate-script`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to generate script: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        this.video = data.video;
      } else {
        this.error = data.error || 'Failed to generate script';
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to generate script';
    } finally {
      this.generatingScript = false;
    }
  }

  private async generateAssets(): Promise<void> {
    if (!this.video) return;

    this.generatingAssets = true;
    this.error = '';

    try {
      const username = 'admin';
      const password = 'GvkP525fTX0ocMTw8XtAqM9ECvNIx50v';
      const credentials = btoa(`${username}:${password}`);

      const response = await fetch(`/api/videos/${this.videoId}/generate-assets`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_model: this.selectedImageModel,
          tts_model: this.selectedTTSModel
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate assets: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        this.video = data.video;
      } else {
        this.error = data.error || 'Failed to generate assets';
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to generate assets';
    } finally {
      this.generatingAssets = false;
    }
  }

  private renderMetadataCard(): unknown {
    if (!this.video) return null;

    return html`
      <div class="card">
        <h2 class="card-title">Video Metadata</h2>
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">ID</span>
            <span class="meta-value">${this.video.id}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Created</span>
            <span class="meta-value">${new Date(this.video.created_at).toLocaleString()}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Title</span>
            <span class="meta-value">${this.video.short_title || 'N/A'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Total Cost</span>
            <span class="meta-value">$${this.video.total_cost.toFixed(4)}</span>
          </div>
        </div>
        <div style="margin-top: 1rem;">
          <div class="badges">
            <span class="badge type-${this.video.video_type}">${this.video.video_type}</span>
            <span class="badge selection-${this.video.selection_status}">${this.video.selection_status}</span>
            <span class="badge script-${this.video.script_status}">${this.video.script_status}</span>
          </div>
        </div>
      </div>
    `;
  }

  private renderSelectionCard(): unknown {
    if (!this.video) return null;

    return html`
      <div class="card">
        <h2 class="card-title">Selection Details</h2>

        ${this.video.notes.length > 0 ? html`
          <div style="margin-bottom: 1.5rem;">
            <h3 style="font-size: 0.875rem; font-weight: 600; color: #374151; margin: 0 0 0.5rem 0;">Notes</h3>
            <ul class="notes-list">
              ${this.video.notes.map(note => html`<li>${note}</li>`)}
            </ul>
          </div>
        ` : ''}

        ${this.video.articles.length > 0 ? html`
          <div>
            <h3 style="font-size: 0.875rem; font-weight: 600; color: #374151; margin: 0 0 0.5rem 0;">Articles</h3>
            <div class="articles-list">
              ${this.video.articles.map(pickId => html`
                <a href="/article/pick:${pickId}" class="article-link">Article: pick:${pickId}</a>
              `)}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderScriptCard(): unknown {
    if (!this.video) return null;

    const { script_status, script, script_error } = this.video;

    return html`
      <div class="card">
        <h2 class="card-title">Video Script</h2>

        ${script_error && script_status === 'error' ? html`
          <div class="error-message">${script_error}</div>
        ` : ''}

        ${script_status === 'pending' ? html`
          <p style="color: #666; margin: 0 0 1rem 0;">No script generated yet.</p>
          <button
            class="script-button"
            @click=${this.generateScript}
            ?disabled=${this.generatingScript}
          >
            ${this.generatingScript ? 'Generating...' : 'Generate Script'}
          </button>
        ` : ''}

        ${script_status === 'generating' ? html`
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div class="loading-spinner"></div>
            <span style="color: #666;">Generating script, please wait...</span>
          </div>
        ` : ''}

        ${script_status === 'error' ? html`
          <button
            class="script-button retry"
            @click=${this.generateScript}
            ?disabled=${this.generatingScript}
          >
            ${this.generatingScript ? 'Retrying...' : 'Retry Generation'}
          </button>
        ` : ''}

        ${script_status === 'generated' && script ? html`
          <div class="script-hero">
            <div class="script-title">${script.title}</div>
            <div class="script-description">${script.description}</div>
            <div class="script-thumbnail">${script.thumbnailDescription}</div>
          </div>

          <div class="slides-header">
            <span class="slides-count">${script.slides.length} Slides</span>
          </div>

          <div class="slides-grid">
            ${script.slides.map((slide, idx) => html`
              <div class="slide-card">
                <div class="slide-number">${idx + 1}</div>
                <div class="slide-headline">${slide.headline}</div>

                <div class="slide-section">
                  <div class="slide-narration">${slide.audioNarration}</div>
                </div>

                <div class="slide-section">
                  <div class="slide-image-desc">${slide.imageDescription}</div>
                </div>

                <span class="slide-duration">${slide.estimatedDuration}s</span>
              </div>
            `)}
          </div>

          <button
            class="script-button"
            @click=${this.generateScript}
            ?disabled=${this.generatingScript}
          >
            ${this.generatingScript ? 'Regenerating...' : 'Regenerate Script'}
          </button>
        ` : ''}
      </div>
    `;
  }

  private getCropStyle(cell: number): string {
    const row = Math.floor(cell / 3);
    const col = cell % 3;
    const left = -(col * 60);
    const top = -(row * 60);
    return `left: ${left}px; top: ${top}px;`;
  }

  private renderAssetsCard(): unknown {
    if (!this.video) return null;

    const { asset_status, asset_error, assets, script, tts_voice } = this.video;
    const hasAssets = assets && assets.length > 0;
    const gridAssets = hasAssets ? assets.filter(a => a.assetType === 'grid_image') : [];
    const audioAssets = hasAssets ? assets.filter(a => a.assetType === 'slide_audio') : [];

    return html`
      <div class="assets-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h2 class="card-title" style="margin: 0;">Video Assets</h2>
          <span class="badge asset-${asset_status}">${asset_status}</span>
        </div>

        ${asset_error && asset_status === 'error' ? html`
          <div class="error-message">${asset_error}</div>
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
            class="asset-button"
            @click=${this.generateAssets}
            ?disabled=${this.generatingAssets}
          >
            ${this.generatingAssets ? 'Generating...' : asset_status === 'error' ? 'Retry Generation' : 'Generate Assets'}
          </button>
        ` : ''}

        ${asset_status === 'generating' ? html`
          <div style="display: flex; align-items: center; gap: 1rem; margin-top: 1rem;">
            <div class="loading-spinner"></div>
            <span style="color: #666;">Generating assets, please wait...</span>
          </div>
        ` : ''}

        ${asset_status === 'generated' && hasAssets ? html`
          <button
            class="asset-button"
            @click=${this.generateAssets}
            ?disabled=${this.generatingAssets}
          >
            ${this.generatingAssets ? 'Regenerating...' : 'Regenerate Assets'}
          </button>

          ${gridAssets.length > 0 ? html`
            <div class="grids-container">
              ${gridAssets.map((asset, idx) => html`
                <div class="grid-preview">
                  <img src="${asset.url}" alt="Grid ${idx}" />
                </div>
              `)}
            </div>
          ` : ''}

          ${audioAssets.length > 0 && script ? html`
            <div style="margin-top: 1.5rem;">
              ${tts_voice ? html`
                <div style="margin-bottom: 1rem;">
                  <span class="badge" style="background: #8b5cf6; color: white;">Voice: ${tts_voice}</span>
                </div>
              ` : ''}

              <div class="slides-audio-list">
                ${audioAssets.map((asset) => {
                  const metadata = asset.metadata as SlideAudioMetadata | null;
                  const slideIndex = metadata?.slideIndex ?? asset.assetIndex;
                  const slide = script.slides[slideIndex];
                  if (!slide) return null;

                  // Find grid image for this slide
                  const gridAsset = gridAssets.find(g => {
                    const gridMeta = g.metadata as GridImageMetadata | null;
                    if (!gridMeta) return false;
                    return gridMeta.positions.some(p => p.slideIndex === slideIndex);
                  });

                  const gridMeta = gridAsset?.metadata as GridImageMetadata | null;
                  const position = gridMeta?.positions.find(p => p.slideIndex === slideIndex);
                  const cell = position?.cell ?? 0;

                  return html`
                    <div class="slide-audio-item">
                      ${gridAsset ? html`
                        <div class="slide-crop">
                          <img src="${gridAsset.url}" style="${this.getCropStyle(cell)}" alt="Slide ${slideIndex + 1}" />
                        </div>
                      ` : ''}

                      <div class="slide-content">
                        <div style="font-weight: 600; color: #1a1a1a;">${slide.headline}</div>
                        <div class="slide-audio-player">
                          <audio controls src="${asset.url}"></audio>
                        </div>
                        ${metadata?.durationMs ? html`
                          <span class="badge" style="background: #f3f4f6; color: #6b7280; align-self: flex-start;">
                            ${(metadata.durationMs / 1000).toFixed(1)}s
                          </span>
                        ` : ''}
                      </div>
                    </div>
                  `;
                })}
              </div>
            </div>
          ` : ''}
        ` : ''}
      </div>
    `;
  }

  render() {
    if (this.loading) {
      return html`
        <div class="container">
          <div style="color: white; text-align: center; padding: 2rem;">Loading...</div>
        </div>
      `;
    }

    if (this.error && !this.video) {
      return html`
        <div class="container">
          <div class="error-message">${this.error}</div>
          <a href="/videos" class="back-link">← Back to Videos</a>
        </div>
      `;
    }

    return html`
      <div class="container">
        <a href="/videos" class="back-link">← Back to Videos</a>

        <div class="cards-container">
          ${this.renderMetadataCard()}
          ${this.renderSelectionCard()}
          ${this.renderScriptCard()}
          ${this.video && this.video.script_status === 'generated' ? this.renderAssetsCard() : ''}
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
