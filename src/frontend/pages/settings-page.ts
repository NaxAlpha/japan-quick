/**
 * Settings page component - Application settings
 * Displays YouTube authentication status and allows connection/disconnection
 *
 * Tokyo Editorial Cyber-Industrial aesthetic
 */

import { LitElement, html, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getAuthHeaders } from '../lib/auth.js';
import { fontImports } from '../styles/design-system.js';

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
  static styles = unsafeCSS(fontImports + `
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
    }

    .container {
      padding: 2rem;
      max-width: 800px;
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

    h1 {
      font-family: "Zen Tokyo Zoo", system-ui, sans-serif;
      font-size: clamp(2.5rem, 8vw, 5rem);
      font-weight: 400;
      line-height: 1.1;
      color: #0a0a0a;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      margin: 0 0 2rem 0;
      position: relative;
      z-index: 1;
    }

    .settings-section {
      background: #ffffff;
      border: 3px solid #0a0a0a;
      box-shadow: 4px 4px 0 #0a0a0a;
      padding: 2rem;
      margin-bottom: 2rem;
      position: relative;
      z-index: 1;
    }

    .section-title {
      font-family: "Zen Tokyo Zoo", system-ui, sans-serif;
      font-size: clamp(1.25rem, 3vw, 1.75rem);
      font-weight: 400;
      color: #0a0a0a;
      margin: 0 0 1.5rem 0;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .status-badge {
      font-family: "Space Mono", monospace;
      font-size: 0.6875rem;
      font-weight: 400;
      padding: 0.25rem 0.75rem;
      border: 1px solid #0a0a0a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }

    .status-badge.connected {
      background: #2d6a4f;
      color: #ffffff;
      border-color: #2d6a4f;
    }

    .status-badge.not-connected {
      background: #78746c;
      color: #ffffff;
      border-color: #78746c;
    }

    .channel-info {
      margin: 1rem 0;
      padding: 1.5rem;
      background: #e8e6e1;
      border: 2px solid #0a0a0a;
      box-shadow: 2px 2px 0 #0a0a0a;
    }

    .channel-name {
      font-family: "Inter", "Noto Sans JP", system-ui, sans-serif;
      font-size: 1.125rem;
      font-weight: 700;
      color: #0a0a0a;
      margin: 0 0 0.25rem 0;
    }

    .channel-id {
      font-family: "Space Mono", monospace;
      font-size: 0.75rem;
      color: #58544c;
      margin: 0;
    }

    .token-info {
      margin: 1rem 0;
      font-family: "Space Mono", monospace;
      font-size: 0.75rem;
      color: #58544c;
    }

    .token-info-row {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px solid #d4d0c8;
    }

    .token-info-row:last-child {
      border-bottom: none;
    }

    .token-expires-soon {
      color: #f59e0b;
      font-weight: 500;
    }

    .token-expired {
      color: #e63946;
      font-weight: 500;
    }

    .scopes-list {
      margin: 1rem 0;
      font-family: "Inter", "Noto Sans JP", system-ui, sans-serif;
      font-size: 0.875rem;
    }

    .scopes-title {
      font-weight: 700;
      color: #0a0a0a;
      margin-bottom: 0.75rem;
      font-family: "Space Mono", monospace;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 0.6875rem;
    }

    .scope-item {
      padding: 0.375rem 0.75rem;
      background: #d4d0c8;
      border: 1px solid #0a0a0a;
      display: inline-block;
      margin: 0.125rem;
      font-size: 0.6875rem;
      color: #282420;
      font-family: "Space Mono", monospace;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .button-group {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
      flex-wrap: wrap;
    }

    .button {
      padding: 0.75rem 1.5rem;
      font-family: "Space Mono", monospace;
      font-size: 0.75rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: all 0.15s ease-out;
      border: 2px solid #0a0a0a;
      box-shadow: 2px 2px 0 #0a0a0a;
    }

    .button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .button:disabled:hover {
      transform: none;
      box-shadow: 2px 2px 0 #0a0a0a;
    }

    .button-primary {
      background: #0066cc;
      color: #ffffff;
      border-color: #0066cc;
    }

    .button-primary:hover:not(:disabled) {
      background: #0a0a0a;
      border-color: #0a0a0a;
      transform: translate(-2px, -2px);
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .button-danger {
      background: #e63946;
      color: #ffffff;
      border-color: #e63946;
    }

    .button-danger:hover:not(:disabled) {
      background: #0a0a0a;
      border-color: #0a0a0a;
      transform: translate(-2px, -2px);
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .button-secondary {
      background: #78746c;
      color: #ffffff;
      border-color: #78746c;
    }

    .button-secondary:hover:not(:disabled) {
      background: #0a0a0a;
      border-color: #0a0a0a;
      transform: translate(-2px, -2px);
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .status-message {
      text-align: center;
      padding: 4rem 1rem;
      color: #78746c;
      font-size: 1.125rem;
      font-family: "Inter", "Noto Sans JP", system-ui, sans-serif;
      position: relative;
      z-index: 1;
    }

    .error-message {
      padding: 1rem 1.5rem;
      background: #e63946;
      border: 2px solid #0a0a0a;
      box-shadow: 2px 2px 0 #0a0a0a;
      color: #ffffff;
      font-size: 0.875rem;
      margin: 1rem 0;
      font-family: "Space Mono", monospace;
      position: relative;
      z-index: 1;
    }

    .success-message {
      padding: 1rem 1.5rem;
      background: #2d6a4f;
      border: 2px solid #0a0a0a;
      box-shadow: 2px 2px 0 #0a0a0a;
      color: #ffffff;
      font-size: 0.875rem;
      margin: 1rem 0;
      font-family: "Space Mono", monospace;
      position: relative;
      z-index: 1;
    }

    .home-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 2rem;
      padding: 0.5rem 1rem;
      background: #0a0a0a;
      border: 2px solid #0a0a0a;
      color: #ffffff;
      font-size: 0.75rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: all 0.15s ease-out;
      text-decoration: none;
      font-family: "Space Mono", monospace;
      box-shadow: 2px 2px 0 #0a0a0a;
      position: relative;
      z-index: 1;
    }

    .home-link:hover {
      background: #e63946;
      border-color: #e63946;
      transform: translate(-1px, -1px);
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .description {
      font-family: "Inter", "Noto Sans JP", system-ui, sans-serif;
      font-size: 0.875rem;
      color: #58544c;
      margin: 0.5rem 0 1.5rem 0;
      line-height: 1.6;
    }
  `);

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
        headers: getAuthHeaders()
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
        headers: getAuthHeaders()
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

        <a href="/" class="home-link">← Back to Home</a>
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
