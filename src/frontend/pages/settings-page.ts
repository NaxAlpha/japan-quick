/**
 * Settings page component - Application settings
 * Displays YouTube authentication status and allows connection/disconnection
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

interface YouTubeAuthStatus {
  isConnected: boolean;
  channel?: {
    id: string;
    title: string;
  };
  scopes?: string[];
  expiresAt?: number;
  tokenExpiresIn?: number;
}

@customElement('settings-page')
export class SettingsPage extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
    }

    .container {
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }

    h1 {
      color: white;
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
    }

    .settings-section {
      background: white;
      border-radius: 0.5rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .section-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 1rem 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;
    }

    .status-badge.connected {
      background: #10b981;
      color: white;
    }

    .status-badge.not-connected {
      background: #6b7280;
      color: white;
    }

    .channel-info {
      margin: 1rem 0;
      padding: 1rem;
      background: #f9fafb;
      border-radius: 0.375rem;
      border: 1px solid #e5e7eb;
    }

    .channel-name {
      font-size: 1rem;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 0.25rem 0;
    }

    .channel-id {
      font-size: 0.875rem;
      color: #6b7280;
      margin: 0;
    }

    .token-info {
      margin: 1rem 0;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .token-info-row {
      display: flex;
      justify-content: space-between;
      padding: 0.25rem 0;
    }

    .token-expires-soon {
      color: #f59e0b;
      font-weight: 500;
    }

    .token-expired {
      color: #ef4444;
      font-weight: 500;
    }

    .scopes-list {
      margin: 1rem 0;
      font-size: 0.875rem;
    }

    .scopes-title {
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 0.5rem;
    }

    .scope-item {
      padding: 0.25rem 0.5rem;
      background: #f3f4f6;
      border-radius: 0.25rem;
      display: inline-block;
      margin: 0.125rem;
      font-size: 0.75rem;
      color: #374151;
    }

    .button-group {
      display: flex;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .button {
      padding: 0.625rem 1.25rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      border: none;
    }

    .button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .button-primary {
      background: #3b82f6;
      color: white;
    }

    .button-primary:hover:not(:disabled) {
      background: #2563eb;
    }

    .button-danger {
      background: #ef4444;
      color: white;
    }

    .button-danger:hover:not(:disabled) {
      background: #dc2626;
    }

    .button-secondary {
      background: #6b7280;
      color: white;
    }

    .button-secondary:hover:not(:disabled) {
      background: #4b5563;
    }

    .status-message {
      text-align: center;
      padding: 2rem 1rem;
      color: rgba(255, 255, 255, 0.8);
      font-size: 1rem;
    }

    .error-message {
      padding: 0.75rem 1rem;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 0.375rem;
      color: #991b1b;
      font-size: 0.875rem;
      margin: 1rem 0;
    }

    .success-message {
      padding: 0.75rem 1rem;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 0.375rem;
      color: #166534;
      font-size: 0.875rem;
      margin: 1rem 0;
    }

    .home-link {
      display: inline-block;
      margin-top: 2rem;
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

    .home-link:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .description {
      font-size: 0.875rem;
      color: #6b7280;
      margin: 0.5rem 0 1rem 0;
      line-height: 1.5;
    }
  `;

  @state()
  private authStatus: YouTubeAuthStatus | null = null;

  @state()
  private loading: boolean = true;

  @state()
  private connecting: boolean = false;

  @state()
  private disconnecting: boolean = false;

  @state()
  private refreshing: boolean = false;

  @state()
  private error: string | null = null;

  @state()
  private message: string | null = null;

  /**
   * Generate Basic Auth headers for API requests
   */
  private getAuthHeaders(): HeadersInit {
    const username = 'admin';
    const password = 'GvkP525fTX0ocMTw8XtAqM9ECvNIx50v';
    const credentials = btoa(`${username}:${password}`);
    return {
      'Authorization': `Basic ${credentials}`
    };
  }

  connectedCallback() {
    super.connectedCallback();

    // Check for OAuth callback messages in URL
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (success === 'connected') {
      this.message = 'YouTube channel connected successfully!';
      // Clear URL params
      window.history.replaceState({}, '', '/settings');
    } else if (error) {
      const errorMessages: Record<string, string> = {
        oauth_error: 'Authorization was denied or cancelled.',
        no_code: 'No authorization code received.',
        no_state: 'Invalid OAuth callback.',
        invalid_state: 'Invalid OAuth state. Please try again.',
        auth_failed: 'Failed to complete authorization.',
      };
      this.error = errorMessages[error] || 'An error occurred.';
      // Clear URL params
      window.history.replaceState({}, '', '/settings');
    }

    this.loadStatus();
  }

  private async loadStatus() {
    try {
      this.loading = true;
      this.error = null;
      this.message = null;

      const response = await fetch('/api/youtube/status', {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        this.authStatus = data.data;
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
        headers: this.getAuthHeaders()
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
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        this.message = 'Disconnected successfully';
        await this.loadStatus();
      } else {
        throw new Error(data.error || 'Failed to disconnect');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to disconnect';
    } finally {
      this.disconnecting = false;
    }
  }

  private async refreshToken() {
    try {
      this.refreshing = true;
      this.error = null;

      const response = await fetch('/api/youtube/refresh', {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        this.message = 'Token refreshed successfully';
        await this.loadStatus();
      } else {
        throw new Error(data.error || 'Failed to refresh token');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to refresh token';
    } finally {
      this.refreshing = false;
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
    return html`
      <div class="container">
        <h1>Settings</h1>

        ${this.renderMessages()}

        ${this.loading ? html`
          <div class="status-message">Loading...</div>
        ` : html`
          ${this.renderYouTubeSection()}
        `}

        <a href="/" class="home-link">Back to Home</a>
      </div>
    `;
  }

  private renderMessages() {
    if (this.error) {
      return html`<div class="error-message">${this.error}</div>`;
    }
    if (this.message) {
      return html`<div class="success-message">${this.message}</div>`;
    }
    return '';
  }

  private renderYouTubeSection() {
    const isConnected = this.authStatus?.isConnected;

    return html`
      <div class="settings-section">
        <h2 class="section-title">
          YouTube Connection
          <span class="status-badge ${isConnected ? 'connected' : 'not-connected'}">
            ${isConnected ? 'Connected' : 'Not Connected'}
          </span>
        </h2>

        <p class="description">
          Connect your YouTube channel to enable video uploads. The app will request
          permission to upload videos and access channel analytics.
        </p>

        ${isConnected ? html`
          ${this.renderChannelInfo()}
          ${this.renderButtonsConnected()}
        ` : html`
          ${this.renderButtonsDisconnected()}
        `}
      </div>
    `;
  }

  private renderChannelInfo() {
    const { authStatus } = this;
    if (!authStatus?.channel) return '';

    const expiresIn = authStatus.tokenExpiresIn;
    const expiryText = this.formatTokenExpires(expiresIn);
    const expiryClass = this.getTokenExpiryClass(expiresIn);

    return html`
      <div class="channel-info">
        <p class="channel-name">${authStatus.channel.title}</p>
        <p class="channel-id">Channel ID: ${authStatus.channel.id}</p>
      </div>

      <div class="token-info">
        <div class="token-info-row ${expiryClass}">
          <span>Token expires in:</span>
          <span>${expiryText}</span>
        </div>
      </div>

      ${authStatus.scopes && authStatus.scopes.length > 0 ? html`
        <div class="scopes-list">
          <p class="scopes-title">Permissions granted:</p>
          ${authStatus.scopes.map(scope => html`
            <span class="scope-item">${this.formatScope(scope)}</span>
          `)}
        </div>
      ` : ''}
    `;
  }

  private formatScope(scope: string): string {
    const scopeNames: Record<string, string> = {
      'https://www.googleapis.com/auth/youtube.upload': 'Upload Videos',
      'https://www.googleapis.com/auth/youtube': 'Manage Account',
      'https://www.googleapis.com/auth/yt-analytics.readonly': 'View Analytics',
    };
    return scopeNames[scope] || scope;
  }

  private renderButtonsConnected() {
    return html`
      <div class="button-group">
        <button
          class="button button-secondary"
          ?disabled=${this.refreshing}
          @click=${this.refreshToken}
        >
          ${this.refreshing ? 'Refreshing...' : 'Refresh Token'}
        </button>
        <button
          class="button button-danger"
          ?disabled=${this.disconnecting}
          @click=${this.disconnect}
        >
          ${this.disconnecting ? 'Disconnecting...' : 'Disconnect'}
        </button>
      </div>
    `;
  }

  private renderButtonsDisconnected() {
    return html`
      <div class="button-group">
        <button
          class="button button-primary"
          ?disabled=${this.connecting}
          @click=${this.startOAuth}
        >
          ${this.connecting ? 'Connecting...' : 'Connect YouTube Channel'}
        </button>
      </div>
    `;
  }
}
