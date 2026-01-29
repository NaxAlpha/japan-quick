/**
 * Video script card component
 * Displays script generation status, script content, and slides
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles, buttonStyles, badgeStyles, loadingStyles } from '../styles/shared-styles.js';
import type { ParsedVideo, ScriptStatus } from '../types/video.js';

@customElement('video-script-card')
export class VideoScriptCard extends LitElement {
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

  private getStatusLabel(status: ScriptStatus): string {
    const labels: Record<ScriptStatus, string> = {
      'pending': 'WAIT',
      'generating': 'GEN...',
      'generated': 'DONE',
      'error': 'FAIL'
    };
    return labels[status] || status;
  }

  private dispatchGenerate() {
    this.dispatchEvent(new CustomEvent('generate-script'));
  }

  render() {
    if (!this.video) return null;

    const { script_status, script, script_error } = this.video;

    return html`
      <div class="card">
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
              @click=${() => this.dispatchGenerate()}
              ?disabled=${this.generating}
            >
              ${this.generating ? html`<span class="loading-spinner"></span> Generating...` : '[ Generate Script ]'}
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
              @click=${() => this.dispatchGenerate()}
              ?disabled=${this.generating}
            >
              ${this.generating ? html`<span class="loading-spinner"></span> Retrying...` : '[ Retry Generation ]'}
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
                @click=${() => this.dispatchGenerate()}
                ?disabled=${this.generating}
              >
                ${this.generating ? html`<span class="loading-spinner"></span> Regenerating...` : '[ Regenerate Script ]'}
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
    'video-script-card': VideoScriptCard;
  }
}
