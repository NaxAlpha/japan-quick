/**
 * Video policy card component
 * Displays a single policy stage (script or asset) with detailed findings.
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles, badgeStyles } from '../styles/shared-styles.js';
import type {
  ParsedVideo,
  PolicyStageStatus,
  PolicyFindingStatus,
  PolicyRun,
  PolicyCheckStage
} from '../types/video.js';

const POLICY_STAGE_STATUS_VALUES: readonly PolicyStageStatus[] = ['PENDING', 'CLEAN', 'WARN', 'REVIEW', 'BLOCK'];

@customElement('video-policy-card')
export class VideoPolicyCard extends LitElement {
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
      flex-wrap: wrap;
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
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .summary {
      font-family: 'Inter', sans-serif;
      font-size: 0.875rem;
      color: #282420;
      line-height: 1.5;
      margin: 0;
    }

    .stage-meta {
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      color: #78746c;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .block-reasons {
      border: 2px solid #e63946;
      background: #0a0a0a;
      color: #e63946;
      padding: 0.75rem;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .block-title {
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .runs {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .run {
      border: 2px solid #e8e6e1;
      background: #fafafa;
      padding: 0.875rem;
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }

    .run-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .run-title {
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      color: #0a0a0a;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .run-meta {
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      color: #78746c;
    }

    .finding-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .finding {
      border: 1px solid #d0cdc7;
      background: #ffffff;
      padding: 0.625rem;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .finding-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .finding-code {
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      color: #58544c;
    }

    .finding-reason {
      font-family: 'Inter', sans-serif;
      font-size: 0.8125rem;
      color: #282420;
      line-height: 1.5;
    }

    .finding-evidence {
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      color: #58544c;
      line-height: 1.4;
    }

    .empty-state {
      border: 2px dashed #d0cdc7;
      background: #fafafa;
      color: #78746c;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      padding: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
  `];

  @property({ type: Object })
  video: ParsedVideo | null = null;

  @property({ type: String })
  stage: PolicyCheckStage = 'script_light';

  private normalizeStageStatus(status: unknown): PolicyStageStatus {
    if (typeof status !== 'string') {
      return 'PENDING';
    }

    const normalized = status.toUpperCase() as PolicyStageStatus;
    return POLICY_STAGE_STATUS_VALUES.includes(normalized) ? normalized : 'PENDING';
  }

  private getStageLabel(stage: string | null | undefined): string {
    if (stage === 'script_light') {
      return 'Script Light Check';
    }
    if (stage === 'asset_strong') {
      return 'Asset Strong Check';
    }
    return stage || 'Unknown Check';
  }

  private normalizeStage(stage: unknown): PolicyCheckStage {
    return stage === 'asset_strong' ? 'asset_strong' : 'script_light';
  }

  private getCardTitle(stage: PolicyCheckStage): string {
    return stage === 'asset_strong' ? 'Asset Policy' : 'Script Policy';
  }

  private getStageStatusBadgeClass(status: PolicyStageStatus | null | undefined): string {
    return `policy-${this.normalizeStageStatus(status).toLowerCase()}`;
  }

  private getFindingBadgeClass(status: PolicyFindingStatus): string {
    if (status === 'PASS') return 'policy-clean';
    if (status === 'WARN') return 'policy-warn';
    if (status === 'REVIEW') return 'policy-review';
    return 'policy-block';
  }

  private formatDateTime(dateString: string): string {
    const normalized = dateString.includes('T') ? dateString : `${dateString.replace(' ', 'T')}Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Tokyo'
    });
  }

  private sortRunsByCreatedAt(runs: PolicyRun[]): PolicyRun[] {
    return [...runs].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return bTime - aTime;
    });
  }

  private getFindings(run: PolicyRun): NonNullable<PolicyRun['findings']> {
    return Array.isArray(run.findings) ? run.findings : [];
  }

  private getStageStatus(video: ParsedVideo, stage: PolicyCheckStage): PolicyStageStatus {
    if (stage === 'asset_strong') {
      return this.normalizeStageStatus(video.asset_policy_status);
    }
    return this.normalizeStageStatus(video.script_policy_status);
  }

  private getStageSummary(stage: PolicyCheckStage, status: PolicyStageStatus, runs: PolicyRun[]): string {
    if (runs.length > 0 && runs[0].summary) {
      return runs[0].summary;
    }

    if (status === 'PENDING') {
      return stage === 'asset_strong'
        ? 'Asset policy check has not run yet.'
        : 'Script policy check has not run yet.';
    }

    return 'No policy summary available yet.';
  }

  private getStageBlockReasons(stageStatus: PolicyStageStatus, runs: PolicyRun[]): string[] {
    if (stageStatus !== 'BLOCK' || runs.length === 0) {
      return [];
    }

    const firstRun = runs[0];
    return this.getFindings(firstRun)
      .filter((finding) => finding.status === 'BLOCK')
      .map((finding) => `${finding.check_code}: ${finding.reason}`);
  }

  render() {
    if (!this.video) return null;

    const stage = this.normalizeStage(this.stage);
    const allRuns = Array.isArray(this.video.policyRuns) ? this.video.policyRuns : [];
    const runs = this.sortRunsByCreatedAt(allRuns.filter((run) => run.stage === stage));
    const stageStatus = this.getStageStatus(this.video, stage);
    const stageLabel = this.getStageLabel(stage);
    const blockReasons = this.getStageBlockReasons(stageStatus, runs);
    const stageSummary = this.getStageSummary(stage, stageStatus, runs);

    return html`
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">${this.getCardTitle(stage)}</h2>
          <span class="badge ${this.getStageStatusBadgeClass(stageStatus)}">
            ${stageStatus}
          </span>
        </div>

        <div class="card-body">
          <div class="stage-meta">${stageLabel}</div>

          <p class="summary">
            ${stageSummary}
          </p>

          ${runs.length > 0 ? html`
            <div class="run-meta">
              Last Checked: ${this.formatDateTime(runs[0].created_at)}
            </div>
          ` : ''}

          ${blockReasons.length > 0 ? html`
            <div class="block-reasons">
              <div class="block-title">Block Reasons</div>
              ${blockReasons.map((reason) => html`<div>${reason}</div>`)}
            </div>
          ` : ''}

          ${runs.length === 0 ? html`
            <div class="empty-state">No ${stage === 'asset_strong' ? 'asset' : 'script'} policy runs yet</div>
          ` : html`
            <div class="runs">
              ${runs.map((run) => html`
                <div class="run">
                  <div class="run-header">
                    <span class="run-title">${this.getStageLabel(run.stage)}</span>
                    <span class="badge ${this.getStageStatusBadgeClass(run.status)}">${run.status}</span>
                  </div>
                  <div class="run-meta">
                    Model: ${run.model_id} | ${this.formatDateTime(run.created_at)}
                  </div>
                  ${run.summary ? html`<div class="summary">${run.summary}</div>` : ''}
                  <div class="finding-list">
                    ${this.getFindings(run).map((finding) => {
                      const evidence = Array.isArray(finding.evidence_json) ? finding.evidence_json : [];
                      return html`
                      <div class="finding">
                        <div class="finding-header">
                          <span class="badge ${this.getFindingBadgeClass(finding.status)}">${finding.status}</span>
                          <span class="finding-code">${finding.check_code}</span>
                        </div>
                        <div class="finding-reason">${finding.check_label}: ${finding.reason}</div>
                        ${evidence.length > 0 ? html`
                          <div class="finding-evidence">
                            Evidence: ${evidence.join(' | ')}
                          </div>
                        ` : ''}
                      </div>
                    `;
                    })}
                  </div>
                </div>
              `)}
            </div>
          `}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'video-policy-card': VideoPolicyCard;
  }
}
