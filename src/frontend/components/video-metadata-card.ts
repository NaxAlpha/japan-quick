/**
 * Video metadata card component
 * Displays video ID, creation date, cost, status badges, and cost logs
 */
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles, badgeStyles } from '../styles/shared-styles.js';
import type { ParsedVideo, RenderStatus, CostLog, YouTubeUploadStatus, PolicyStageStatus } from '../types/video.js';

const POLICY_STAGE_STATUS_VALUES: readonly PolicyStageStatus[] = ['PENDING', 'CLEAN', 'WARN', 'REVIEW', 'BLOCK'];

@customElement('video-metadata-card')
export class VideoMetadataCard extends LitElement {
  static styles = [baseStyles, badgeStyles, css`
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

    /* Cost Logs Section */
    .cost-logs-section {
      margin-top: 1rem;
      border-top: 2px solid #e8e6e1;
    }

    .cost-logs-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1.25rem;
      cursor: pointer;
      user-select: none;
      transition: background-color 0.15s ease-out;
    }

    .cost-logs-header:hover {
      background-color: #f5f3f0;
    }

    .cost-logs-header-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .cost-logs-title {
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      font-weight: 700;
      color: #0a0a0a;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .cost-logs-count {
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      font-weight: 400;
      color: #78746c;
      background: #e8e6e1;
      padding: 0.125rem 0.375rem;
      border-radius: 2px;
    }

    .cost-logs-expand-icon {
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      color: #78746c;
      transition: transform 0.15s ease-out;
    }

    .cost-logs-expand-icon.expanded {
      transform: rotate(90deg);
    }

    .cost-logs-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease-out;
    }

    .cost-logs-content.expanded {
      max-height: 500px;
      overflow-y: auto;
    }

    .cost-logs-grid {
      padding: 0 1.25rem 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .cost-logs-card {
      background: #f5f3f0;
      border: 2px solid #e8e6e1;
      padding: 0.75rem;
      transition: border-color 0.15s ease-out;
    }

    .cost-logs-card:hover {
      border-color: #d0cdc7;
    }

    .cost-logs-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    .cost-logs-card-type {
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      font-weight: 700;
      color: #0a0a0a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: #ffffff;
      padding: 0.25rem 0.5rem;
      border: 1px solid #0a0a0a;
    }

    .cost-logs-card-cost {
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      font-weight: 700;
      color: #e63946;
    }

    .cost-logs-card-model {
      font-family: 'Inter', sans-serif;
      font-size: 0.75rem;
      font-weight: 500;
      color: #58544c;
      margin-bottom: 0.375rem;
    }

    .cost-logs-card-tokens {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      color: #78746c;
    }

    .cost-logs-card-tokens-separator {
      color: #d0cdc7;
    }

    .cost-logs-empty {
      padding: 1.25rem;
      text-align: center;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      color: #78746c;
    }
  `];

  @property({ type: Object })
  video: ParsedVideo | null = null;

  @property({ type: Array })
  costLogs: CostLog[] = [];

  @state()
  private logsExpanded = false;

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

  private getYouTubeStatusLabel(status: YouTubeUploadStatus): string {
    const labels: Record<YouTubeUploadStatus, string> = {
      'pending': 'WAIT',
      'uploading': 'UP...',
      'processing': 'PROC.',
      'uploaded': 'DONE',
      'blocked': 'BLOCK',
      'error': 'FAIL'
    };
    return labels[status] || status;
  }

  private normalizePolicyStatus(status: unknown): PolicyStageStatus {
    if (typeof status !== 'string') {
      return 'PENDING';
    }

    const normalized = status.toUpperCase() as PolicyStageStatus;
    return POLICY_STAGE_STATUS_VALUES.includes(normalized) ? normalized : 'PENDING';
  }

  private getPolicyStatusLabel(status: PolicyStageStatus | null | undefined): string {
    const normalized = this.normalizePolicyStatus(status);
    const labels: Record<PolicyStageStatus, string> = {
      PENDING: 'WAIT',
      CLEAN: 'CLEAN',
      WARN: 'WARN',
      REVIEW: 'REVIEW',
      BLOCK: 'BLOCK'
    };
    return labels[normalized] || normalized;
  }

  private getFormatLabel(video: ParsedVideo): string {
    const format = video.video_format || video.video_type;
    const labels: Record<string, string> = {
      'single_short': 'SHORT',
      'multi_short': 'MULTI',
      'long': 'LONG',
      'short': 'SHORT'
    };
    return labels[format] || format.toUpperCase();
  }

  private getLogTypeLabel(logType: string): string {
    const labels: Record<string, string> = {
      'video-selection': 'Selection',
      'script-generation': 'Script',
      'asset-generation': 'Assets',
      'image-generation': 'Images',
      'audio-generation': 'TTS',
      'policy-script-light': 'Policy Script',
      'policy-asset-strong': 'Policy Asset',
      'video-render': 'Render',
      'youtube-upload': 'YouTube'
    };
    return labels[logType] || logType;
  }

  private getModelName(modelId: string): string {
    const names: Record<string, string> = {
      'gemini-3-flash-preview': 'Gemini 3 Flash',
      'gemini-3-pro-preview': 'Gemini 3 Pro',
      'gemini-2.5-flash-preview-tts': 'Gemini 2.5 Flash TTS',
      'gemini-2.5-pro-preview-tts': 'Gemini 2.5 Pro TTS',
      'gemini-2.5-flash-image': 'Gemini 2.5 Flash Image',
      'gemini-3-pro-image-preview': 'Gemini 3 Pro Image',
      'gemini-2.5-flash': 'Gemini 2.5 Flash',
      'gemini-2.5-pro': 'Gemini 2.5 Pro'
    };
    return names[modelId] || modelId;
  }

  private formatTokens(tokens: number | null): string {
    if (tokens === null) return '—';
    return tokens.toLocaleString();
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

  private toggleLogs(): void {
    this.logsExpanded = !this.logsExpanded;
  }

  render() {
    if (!this.video) return null;
    const policyStatus = this.normalizePolicyStatus(this.video.policy_overall_status);

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
              <span class="meta-value">${this.formatDateTime(this.video.created_at)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Cost</span>
              <span class="meta-value">$${this.video.total_cost.toFixed(4)}</span>
            </div>
          </div>
          <div style="margin-top: 1rem;">
            <div class="badges">
              <span class="badge type-${this.video.video_type}">${this.getFormatLabel(this.video)}</span>
              <span class="badge selection-${this.video.selection_status}">${this.getStatusLabel(this.video.selection_status)}</span>
              <span class="badge script-${this.video.script_status}">SCR: ${this.getStatusLabel(this.video.script_status)}</span>
              <span class="badge asset-${this.video.asset_status}">AST: ${this.getStatusLabel(this.video.asset_status)}</span>
              <span class="badge render-${this.video.render_status}">RND: ${this.getRenderStatusLabel(this.video.render_status)}</span>
              <span class="badge policy-${policyStatus.toLowerCase()}">POL: ${this.getPolicyStatusLabel(policyStatus)}</span>
              <span class="badge youtube-${this.video.youtube_upload_status}">YT: ${this.getYouTubeStatusLabel(this.video.youtube_upload_status)}</span>
            </div>
          </div>
        </div>

        <!-- Cost Logs Section -->
        <div class="cost-logs-section">
          <div class="cost-logs-header" @click=${this.toggleLogs}>
            <div class="cost-logs-header-left">
              <span class="cost-logs-title">Cost Logs</span>
              <span class="cost-logs-count">${this.costLogs.length}</span>
            </div>
            <span class="cost-logs-expand-icon ${this.logsExpanded ? 'expanded' : ''}">▶</span>
          </div>
          <div class="cost-logs-content ${this.logsExpanded ? 'expanded' : ''}">
            ${this.costLogs.length === 0 ? html`
              <div class="cost-logs-empty">No cost logs yet</div>
            ` : html`
              <div class="cost-logs-grid">
                ${this.costLogs.map((log) => html`
                  <div class="cost-logs-card">
                    <div class="cost-logs-card-header">
                      <span class="cost-logs-card-type">${this.getLogTypeLabel(log.log_type)}</span>
                      <span class="cost-logs-card-cost">$${log.cost.toFixed(4)}</span>
                    </div>
                    <div class="cost-logs-card-model">${this.getModelName(log.model_id)}</div>
                    <div class="cost-logs-card-tokens">
                      <span>${this.formatTokens(log.input_tokens)} in</span>
                      <span class="cost-logs-card-tokens-separator">│</span>
                      <span>${this.formatTokens(log.output_tokens)} out</span>
                    </div>
                  </div>
                `)}
              </div>
            `}
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
