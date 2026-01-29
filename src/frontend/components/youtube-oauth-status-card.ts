/**
 * YouTube OAuth status card component
 * Displays YouTube connection status and actions
 */
import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { getAuthHeaders } from '../lib/auth.js';
import { baseStyles, buttonStyles, badgeStyles, loadingStyles } from '../styles/shared-styles.js';

@customElement('youtube-oauth-status-card')
export class YouTubeOAuthStatusCard extends LitElement {
  static styles = [baseStyles, badgeStyles, loadingStyles, css`
    .settings-section {
      background: #ffffff;
      border: 3px solid #0a0a0a;
      box-shadow: 4px 4px 0 #0a0a0a;
      padding: 2rem;
      margin-bottom: 1.5rem;
      position: relative;
      z-index: 1;
    }

    .settings-section::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: #e63946;
    }

    .section-title {
      font-family: 'Zen Tokyo Zoo', sans-serif;
      font-size: clamp(1.25rem, 3vw, 1.5rem);
      font-weight: 400;
      color: #0a0a0a;
      margin: 0 0 1rem 0;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .description {
      font-family: 'Inter', 'Noto Sans JP', sans-serif;
      font-size: 0.9375rem;
      color: #58544c;
      margin: 0 0 1.5rem 0;
      line-height: 1.6;
    }

    .button-group {
      display: flex;
      gap: 0.75rem;
      margin-top: 1.5rem;
      flex-wrap: wrap;
    }

    @media (max-width: 640px) {
      .settings-section {
        padding: 1.5rem;
      }

      .button-group {
        flex-direction: column;
      }

      .button {
        width: 100%;
        text-align: center;
      }
    }
  `];

  @property({ type: Boolean })
  isYouTubeConnected: boolean = false;

  @state()
  private loading: boolean = true;

  @state()
  private connecting: boolean = false;

  @state()
  private disconnecting: boolean = false;

  @state()
  private error: string | null = null;

  @state()
  private message: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.loadStatus();
  }

  private async loadStatus() {
    try {
      this.loading = true;
      this.error = null;
      this.message = null;

      const response = await fetch('/api/youtube/status', {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        (this as unknown as { isYouTubeConnected: boolean }).isYouTubeConnected = data.data.isConnected;
      } else {
        throw new Error(data.error || 'Failed to load status');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load status';
    } finally {
      this.loading = false;
    }
  }

  private async startOAuth() {
    try {
      this.connecting = true;
      this.error = null;

      const response = await fetch('/api/youtube/auth/url', {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.data.url) {
        // Redirect to Google OAuth
        window.location.href = data.data.url;
      } else {
        throw new Error('Failed to generate authorization URL');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to start OAuth flow';
      this.connecting = false;
    }
  }

  private async disconnect() {
    if (!confirm('Are you sure you want to disconnect your YouTube channel?')) {
      return;
    }

    try {
      this.disconnecting = true;
      this.error = null;

      const response = await fetch('/api/youtube/auth', {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        this.message = 'Disconnected successfully';
        (this as unknown as { isYouTubeConnected: boolean }).isYouTubeConnected = false;
      } else {
        throw new Error(data.error || 'Failed to disconnect');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to disconnect';
    } finally {
      this.disconnecting = false;
    }
  }

  render() {
    if (this.loading) {
      return html`
        <div class="settings-section">
          <div class="loading-row">
            <span class="loading-spinner"></span>
            <span>Loading settings...</span>
          </div>
        </div>
      `;
    }

    return html`
      <div class="settings-section">
        <h2 class="section-title">
          YouTube Connection
          <span class="badge ${this.isYouTubeConnected ? 'connected' : 'not-connected'}">
            ${this.isYouTubeConnected ? 'Connected' : 'Not Connected'}
          </span>
        </h2>

        <p class="description">
          Connect your YouTube channel to enable video uploads. The app will request
          permission to upload videos and access channel analytics.
        </p>

        ${this.isYouTubeConnected ? html`
          ${this.renderConnectedActions()}
        ` : html`
          ${this.renderDisconnectedActions()}
        `}
      </div>
    `;
  }

  private renderConnectedActions() {
    return html`
      <div class="button-group">
        <button
          class="button button-secondary"
          ?disabled=${this.disconnecting}
          @click=${this.disconnect}
        >
          ${this.disconnecting ? '[ DISCONNECTING... ]' : '[ Disconnect Channel ]'}
        </button>
      </div>
    `;
  }

  private renderDisconnectedActions() {
    return html`
      <div class="button-group">
        <button
          class="button button-primary"
          ?disabled=${this.connecting}
          @click=${this.startOAuth}
        >
          ${this.connecting ? '[ CONNECTING... ]' : '[ Connect YouTube Channel ]'}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'youtube-oauth-status-card': YouTubeOAuthStatusCard;
  }
}
