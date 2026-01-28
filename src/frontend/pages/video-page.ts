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
import type {
  ParsedVideo,
  ImageModelId,
  TTSModelId,
  GridImageMetadata,
  SlideAudioMetadata,
  RenderedVideoMetadata,
  RenderStatus
} from '../types/video.js';

@customElement('video-page')
export class VideoPage extends LitElement {
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
      max-width: 1400px;
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

    .back-link {
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
    }

    .back-link:hover {
      background: #e63946;
      border-color: #e63946;
      transform: translate(-1px, -1px);
      box-shadow: 3px 3px 0 #0a0a0a;
    }

    h1 {
      font-family: 'Zen Tokyo Zoo', sans-serif;
      font-size: clamp(1.5rem, 4vw, 2.5rem);
      font-weight: 400;
      line-height: 1;
      color: #0a0a0a;
      margin: 0;
      text-transform: uppercase;
    }

    h1 .accent {
      color: #e63946;
    }

    /* Cards container */
    .cards-container {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 1.5rem;
      position: relative;
      z-index: 1;
    }

    .card {
      background: #ffffff;
      border: 3px solid #0a0a0a;
      box-shadow: 4px 4px 0 #0a0a0a;
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

    /* Badges */
    .badges {
      display: flex;
      gap: 0.375rem;
      flex-wrap: wrap;
    }

    .badge {
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      font-weight: 400;
      padding: 0.25rem 0.5rem;
      border: 1px solid #0a0a0a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
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

    .badge.selection-todo {
      background: #e9c46a;
      color: #78350f;
      border-color: #e9c46a;
    }

    .badge.selection-doing {
      background: #0066cc;
      color: #ffffff;
      border-color: #0066cc;
    }

    .badge.selection-done {
      background: #2d6a4f;
      color: #ffffff;
      border-color: #2d6a4f;
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

    .badge.render-pending {
      background: #f5f3f0;
      color: #58544c;
    }

    .badge.render-rendering {
      background: #0066cc;
      color: #ffffff;
      border-color: #0066cc;
    }

    .badge.render-rendered {
      background: #2d6a4f;
      color: #ffffff;
      border-color: #2d6a4f;
    }

    .badge.render-error {
      background: #0a0a0a;
      color: #e63946;
      border-color: #e63946;
    }

    /* Meta grid */
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

    /* Notes list */
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

    /* Articles list */
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

    /* Buttons */
    .btn {
      padding: 0.75rem 1.25rem;
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
      box-shadow: 3px 3px 0 #0a0a0a;
    }

    .btn:hover:not(:disabled) {
      background: #e63946;
      border-color: #e63946;
      transform: translate(-1px, -1px);
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .btn:focus-visible {
      outline: 3px solid #e63946;
      outline-offset: 3px;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: 3px 3px 0 #0a0a0a;
    }

    .btn-primary {
      background: #e63946;
      border-color: #e63946;
    }

    .btn-primary:hover:not(:disabled) {
      background: #0a0a0a;
      border-color: #0a0a0a;
    }

    .btn-success {
      background: #2d6a4f;
      border-color: #2d6a4f;
    }

    .btn-success:hover:not(:disabled) {
      background: #0a0a0a;
      border-color: #0a0a0a;
    }

    /* Script hero */
    .script-hero {
      padding-bottom: 1.5rem;
      border-bottom: 2px solid #e8e6e1;
      margin-bottom: 1.5rem;
    }

    .script-title {
      font-family: 'Zen Tokyo Zoo', sans-serif;
      font-size: 1.5rem;
      font-weight: 400;
      color: #0a0a0a;
      line-height: 1.2;
      margin-bottom: 0.75rem;
    }

    .script-description {
      font-family: 'Inter', sans-serif;
      font-size: 0.875rem;
      color: #58544c;
      line-height: 1.7;
      margin-bottom: 1rem;
    }

    .script-thumbnail {
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      color: #78746c;
      background: #f5f3f0;
      padding: 0.75rem 1rem;
      border-left: 3px solid #e63946;
      font-style: italic;
      line-height: 1.6;
    }

    /* Slides grid */
    .slides-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .slides-count {
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      color: #78746c;
    }

    .slides-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 1rem;
    }

    .slide-card {
      background: #fafafa;
      border: 2px solid #e8e6e1;
      padding: 1rem;
      position: relative;
      transition: all 0.15s ease-out;
    }

    .slide-card:hover {
      border-color: #e63946;
      box-shadow: 2px 2px 0 #e63946;
    }

    .slide-number {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      background: #e63946;
      color: #ffffff;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      font-weight: 700;
    }

    .slide-headline {
      font-family: 'Inter', sans-serif;
      font-size: 0.875rem;
      font-weight: 700;
      color: #0a0a0a;
      margin-bottom: 0.75rem;
      padding-right: 2rem;
      line-height: 1.4;
    }

    .slide-narration {
      font-family: 'Inter', sans-serif;
      font-size: 0.75rem;
      color: #282420;
      line-height: 1.6;
      padding: 0.5rem 0.75rem;
      background: #ffffff;
      border: 1px solid #e8e6e1;
      margin-bottom: 0.5rem;
    }

    .slide-image-desc {
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      color: #78746c;
      line-height: 1.5;
      padding-left: 0.75rem;
      border-left: 2px solid #d4d0c8;
      font-style: italic;
    }

    .slide-duration {
      display: inline-block;
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      color: #78746c;
      background: #e8e6e1;
      padding: 0.25rem 0.5rem;
      margin-top: 0.5rem;
    }

    /* Model selectors */
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

    /* Grid previews */
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

    /* Audio list */
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

    /* Status & error */
    .error-message {
      padding: 0.75rem 1rem;
      background: #0a0a0a;
      border: 3px solid #e63946;
      color: #e63946;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      margin-bottom: 1rem;
    }

    .loading-spinner {
      display: inline-block;
      width: 1rem;
      height: 1rem;
      border: 2px solid #e8e6e1;
      border-top-color: #e63946;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-family: 'Space Mono', monospace;
      font-size: 0.8125rem;
      color: #58544c;
    }

    /* Voice badge */
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

    /* Render video player */
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
  private renderingVideo = false;

  @state()
  private renderStatus: RenderStatus = 'pending';

  @state()
  private renderPollInterval: number | null = null;

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

  private async renderVideo(): Promise<void> {
    if (!this.video) return;

    this.renderingVideo = true;
    this.error = '';

    try {
      const username = 'admin';
      const password = 'GvkP525fTX0ocMTw8XtAqM9ECvNIx50v';
      const credentials = btoa(`${username}:${password}`);

      const response = await fetch(`/api/videos/${this.videoId}/render`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`
        }
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

  private startRenderPolling(): void {
    if (this.renderPollInterval) {
      clearInterval(this.renderPollInterval);
    }

    this.renderPollInterval = window.setInterval(() => {
      this.checkRenderStatus();
    }, 3000); // Poll every 3 seconds
  }

  private stopRenderPolling(): void {
    if (this.renderPollInterval) {
      clearInterval(this.renderPollInterval);
      this.renderPollInterval = null;
    }
  }

  private async checkRenderStatus(): Promise<void> {
    try {
      const username = 'admin';
      const password = 'GvkP525fTX0ocMTw8XtAqM9ECvNIx50v';
      const credentials = btoa(`${username}:${password}`);

      const response = await fetch(`/api/videos/${this.videoId}/render/status`, {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data.success) {
        this.renderStatus = data.renderStatus;

        if (data.renderStatus === 'rendered') {
          this.stopRenderPolling();
          this.renderingVideo = false;
          // Reload video to get rendered video asset
          await this.loadVideo();
        } else if (data.renderStatus === 'error') {
          this.stopRenderPolling();
          this.renderingVideo = false;
          this.error = data.renderError || 'Render failed';
        }
      }
    } catch (err) {
      console.error('Failed to check render status:', err);
    }
  }

  disconnectedCallback(): void {
    this.stopRenderPolling();
    super.disconnectedCallback();
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

  private getRenderMetadata(metadata: GridImageMetadata | SlideAudioMetadata | RenderedVideoMetadata | null): RenderedVideoMetadata | null {
    if (!metadata) return null;
    if ('fps' in metadata) return metadata as RenderedVideoMetadata;
    return null;
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
          ${this.renderMetadataCard()}
          ${this.renderSelectionCard()}
          ${this.renderScriptCard()}
          ${this.video && this.video.script_status === 'generated' ? this.renderAssetsCard() : ''}
          ${this.video && this.video.asset_status === 'generated' ? this.renderRenderCard() : ''}
        </div>
      </div>
    `;
  }

  private renderMetadataCard(): unknown {
    if (!this.video) return null;

    return html`
      <div class="card span-4">
        <div class="card-header">
          <h2 class="card-title">Metadata</h2>
        </div>
        <div class="card-body">
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">ID</span>
              <span class="meta-value">#${this.video.id}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Created</span>
              <span class="meta-value">${new Date(this.video.created_at).toLocaleDateString()}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Cost</span>
              <span class="meta-value">$${this.video.total_cost.toFixed(4)}</span>
            </div>
          </div>
          <div style="margin-top: 1rem;">
            <div class="badges">
              <span class="badge type-${this.video.video_type}">${this.video.video_type.toUpperCase()}</span>
              <span class="badge selection-${this.video.selection_status}">${this.getStatusLabel(this.video.selection_status)}</span>
              <span class="badge script-${this.video.script_status}">SCR: ${this.getStatusLabel(this.video.script_status)}</span>
              <span class="badge asset-${this.video.asset_status}">AST: ${this.getStatusLabel(this.video.asset_status)}</span>
              <span class="badge render-${this.video.render_status}">RND: ${this.getRenderStatusLabel(this.video.render_status)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
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

  private renderSelectionCard(): unknown {
    if (!this.video) return null;

    return html`
      <div class="card span-8">
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

  private renderScriptCard(): unknown {
    if (!this.video) return null;

    const { script_status, script, script_error } = this.video;

    return html`
      <div class="card span-full">
        <div class="card-header">
          <h2 class="card-title">Script</h2>
          <span class="badge script-${script_status}">${this.getStatusLabel(script_status)}</span>
        </div>
        <div class="card-body">
          ${script_error && script_status === 'error' ? html`
            <div class="error-message">[ ERROR: ${script_error} ]</div>
          ` : ''}

          ${script_status === 'pending' ? html`
            <p style="font-family: 'Inter', sans-serif; font-size: 0.875rem; color: #58544c; margin: 0 0 1rem 0;">No script generated yet.</p>
            <button
              class="btn btn-primary"
              @click=${this.generateScript}
              ?disabled=${this.generatingScript}
            >
              ${this.generatingScript ? html`<span class="loading-spinner"></span> Generating...` : '[ Generate Script ]'}
            </button>
          ` : ''}

          ${script_status === 'generating' ? html`
            <div class="loading-row">
              <span class="loading-spinner"></span>
              <span>Generating script, please wait...</span>
            </div>
          ` : ''}

          ${script_status === 'error' ? html`
            <button
              class="btn"
              @click=${this.generateScript}
              ?disabled=${this.generatingScript}
            >
              ${this.generatingScript ? html`<span class="loading-spinner"></span> Retrying...` : '[ Retry Generation ]'}
            </button>
          ` : ''}

          ${script_status === 'generated' && script ? html`
            <div class="script-hero">
              <div class="script-title">${script.title}</div>
              <div class="script-description">${script.description}</div>
              <div class="script-thumbnail">📷 ${script.thumbnailDescription}</div>
            </div>

            <div class="slides-header">
              <span class="slides-count">${script.slides.length} SLIDES</span>
            </div>

            <div class="slides-grid">
              ${script.slides.map((slide, idx) => html`
                <div class="slide-card">
                  <div class="slide-number">${idx + 1}</div>
                  <div class="slide-headline">${slide.headline}</div>
                  <div class="slide-narration">${slide.audioNarration}</div>
                  <div class="slide-image-desc">${slide.imageDescription}</div>
                  <span class="slide-duration">${slide.estimatedDuration}s</span>
                </div>
              `)}
            </div>

            <div style="margin-top: 1.5rem;">
              <button
                class="btn"
                @click=${this.generateScript}
                ?disabled=${this.generatingScript}
              >
                ${this.generatingScript ? html`<span class="loading-spinner"></span> Regenerating...` : '[ Regenerate Script ]'}
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderAssetsCard(): unknown {
    if (!this.video) return null;

    const { asset_status, asset_error, assets, script, tts_voice, slideImageAssetIds, slideAudioAssetIds } = this.video;
    const hasAssets = assets && assets.length > 0;

    return html`
      <div class="card span-full">
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
              @click=${this.generateAssets}
              ?disabled=${this.generatingAssets}
            >
              ${this.generatingAssets ? html`<span class="loading-spinner"></span> Generating...` : '[ Generate Assets ]'}
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
                @click=${this.generateAssets}
                ?disabled=${this.generatingAssets}
              >
                ${this.generatingAssets ? html`<span class="loading-spinner"></span> Regenerating...` : '[ Regenerate Assets ]'}
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

  private renderRenderCard(): unknown {
    if (!this.video) return null;

    const { render_status, render_error, renderedVideo } = this.video;

    return html`
      <div class="card span-full">
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
              @click=${this.renderVideo}
              ?disabled=${this.renderingVideo}
            >
              ${this.renderingVideo ? html`<span class="loading-spinner"></span> Starting render...` : '[ Render Video ]'}
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
                    <span class="meta-value">${this.getRenderMetadata(renderedVideo.metadata)?.width || 0}x${this.getRenderMetadata(renderedVideo.metadata)?.height || 0}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Duration</span>
                    <span class="meta-value">${((this.getRenderMetadata(renderedVideo.metadata)?.durationMs || 0) / 1000).toFixed(1)}s</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">FPS</span>
                    <span class="meta-value">${this.getRenderMetadata(renderedVideo.metadata)?.fps || 0}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Size</span>
                    <span class="meta-value">${((renderedVideo.fileSize || 0) / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>
              ` : ''}
              <button
                class="btn"
                @click=${this.renderVideo}
                ?disabled=${this.renderingVideo}
              >
                ${this.renderingVideo ? html`<span class="loading-spinner"></span> Re-rendering...` : '[ Re-render Video ]'}
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
    'video-page': VideoPage;
  }
}
