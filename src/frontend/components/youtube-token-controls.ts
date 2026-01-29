/**
 * YouTube token controls component
 * Provides buttons to refresh token and disconnect
 */
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getAuthHeaders } from '../lib/auth.js';
import { baseStyles, buttonStyles, loadingStyles } from '../styles/shared-styles.js';

@customElement('youtube-token-controls')
export class YouTubeTokenControls extends LitElement {
  static styles = [baseStyles, buttonStyles, loadingStyles, css`
    .token-info {
      margin: 1rem 0;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      color: #78746c;
    }

    .token-info-row {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px solid #e8e6e1;
    }

    .token-info-row:last-child {
      border-bottom: none;
    }

    .token-expires-soon {
      color: #f97316;
      font-weight: 700;
    }

    .token-expired {
      color: #e63946;
      font-weight: 700;
    }

    .button-group {
      display: flex;
      gap: 0.75rem;
      margin-top: 1.5rem;
      flex-wrap: wrap;
    }

    @media (max-width: 640px) {
      .button-group {
        flex-direction: column;
      }

      .button {
        width: 100%;
        text-align: center;
      }
    }
  `];

  @state()
  private loading: boolean = true;

  @state()
  private refreshing: boolean = false;

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

      const response = await fetch('/api/youtube/status', {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        this.loading = false;
      }
    } catch (err) {
      console.error('Failed to load YouTube status:', err);
      this.loading = false;
    }
  }

  private async refreshToken() {
    try {
      this.refreshing = true;
      this.error = null;

      const response = await fetch('/api/youtube/refresh', {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        this.message = 'Token refreshed successfully';
        setTimeout(() => {
          this.message = null;
        }, 3000);
      } else {
        throw new Error(data.error || 'Failed to refresh token');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to refresh token';
    } finally {
      this.refreshing = false;
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
        setTimeout(() => {
          this.message = null;
        }, 3000);
      } else {
        throw new Error(data.error || 'Failed to disconnect');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to disconnect';
    } finally {
      this.disconnecting = false;
    }
  }

  private formatTokenExpires(expiresIn: number | undefined): string {
    if (expiresIn === undefined) return 'Unknown';

    if (expiresIn <= 0) return 'Expired';

    const hours = Math.floor(expiresIn / 3600);
    const minutes = Math.floor((expiresIn % 3600) / 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''}`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  private getTokenExpiryClass(expiresIn: number | undefined): string {
    if (expiresIn === undefined) return '';
    if (expiresIn <= 0) return 'token-expired';
    if (expiresIn < 300) return 'token-expires-soon'; // Less than 5 minutes
    return '';
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading-row">
          <span class="loading-spinner"></span>
          <span>Loading token info...</span>
        </div>
      `;
    }

    return html`
      <div class="token-info">
        <div class="token-info-row">
          <span>Token Status: </span>
          <span class="badge connected">Connected</span>
        </div>
      </div>

      ${this.error ? html`
        <div class="error-message">${this.error}</div>
      ` : ''}

      ${this.message ? html`
        <div class="success-message">${this.message}</div>
      ` : ''}

      <div class="button-group">
        <button
          class="button button-secondary"
          ?disabled=${this.refreshing}
          @click=${this.refreshToken}
        >
          ${this.refreshing ? '[ REFRESHING... ]' : '[ Refresh Token ]'}
        </button>
        <button
          class="button button-danger"
          ?disabled=${this.disconnecting}
          @click=${this.disconnect}
        >
          ${this.disconnecting ? '[ DISCONNECTING... ]' : '[ Disconnect Channel ]'}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'youtube-token-controls': YouTubeTokenControls;
  }
}
