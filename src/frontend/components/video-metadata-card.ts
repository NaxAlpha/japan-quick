/**
 * Video metadata card component
 * Displays video ID, creation date, cost, and status badges
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles, badgeStyles } from '../styles/shared-styles.js';
import type { ParsedVideo, RenderStatus } from '../types/video.js';

@customElement('video-metadata-card')
export class VideoMetadataCard extends LitElement {
  static styles = [baseStyles, badgeStyles, css`
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

    .badges {
      display: flex;
      gap: 0.375rem;
      flex-wrap: wrap;
    }
  `];

  @property({ type: Object })
  video: ParsedVideo | null = null;

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

  private getRenderStatusLabel(status: RenderStatus): string {
    const labels: Record<RenderStatus, string> = {
      'pending': 'WAIT',
      'rendering': 'RENDER...',
      'rendered': 'DONE',
      'error': 'FAIL'
    };
    return labels[status] || status;
  }

  render() {
    if (!this.video) return null;

    return html`
      <div class="card">
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
}

declare global {
  interface HTMLElementTagNameMap {
    'video-metadata-card': VideoMetadataCard;
  }
}
