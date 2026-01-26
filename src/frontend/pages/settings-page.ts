/**
 * Settings page component - Application settings
 * Displays YouTube authentication status and allows connection/disconnection
 *
 * Tokyo Cyber-Industrial aesthetic
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
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Zen+Tokyo+Zoo&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Inter:wght@400;500;600;700;800&display=swap');

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

    /* Japanese character decoration */
    .japanese-deco {
      position: fixed;
      font-family: 'Zen Tokyo Zoo', sans-serif;
      font-size: clamp(10rem, 25vw, 20rem);
      color: rgba(230, 57, 70, 0.03);
      line-height: 1;
      pointer-events: none;
      z-index: 0;
      user-select: none;
    }

    .japanese-deco.top {
      top: 10%;
      right: -5%;
      transform: rotate(5deg);
    }

    .japanese-deco.bottom {
      bottom: 5%;
      left: -5%;
      transform: rotate(-5deg);
    }

    /* Back link */
    .home-link {
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
      margin-bottom: 2rem;
      position: relative;
      z-index: 1;
    }

    .home-link:hover {
      background: #e63946;
      border-color: #e63946;
      transform: translate(-1px, -1px);
      box-shadow: 3px 3px 0 #0a0a0a;
    }

    h1 {
      font-family: 'Zen Tokyo Zoo', sans-serif;
      font-size: clamp(1.75rem, 5vw, 2.5rem);
      font-weight: 400;
      line-height: 1.1;
      color: #0a0a0a;
      margin: 0 0 2rem 0;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      position: relative;
      z-index: 1;
    }

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

    .status-badge {
      font-family: 'Space Mono', monospace;
      font-size: 0.625rem;
      font-weight: 400;
      padding: 0.25rem 0.5rem;
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

    .description {
      font-family: 'Inter', 'Noto Sans JP', sans-serif;
      font-size: 0.9375rem;
      color: #58544c;
      margin: 0 0 1.5rem 0;
      line-height: 1.6;
    }

    .channel-info {
      margin: 1.5rem 0;
      padding: 1rem;
      background: #0a0a0a;
      border: 2px solid #0a0a0a;
      box-shadow: 3px 3px 0 #e63946;
    }

    .channel-name {
      font-family: 'Space Mono', monospace;
      font-size: 0.875rem;
      font-weight: 400;
      color: #e63946;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 0.5rem 0;
    }

    .channel-id {
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      color: #f5f3f0;
      margin: 0;
    }

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

    .scopes-list {
      margin: 1.5rem 0;
    }

    .scopes-title {
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      font-weight: 400;
      color: #0a0a0a;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 0.75rem;
    }

    .scope-item {
      padding: 0.375rem 0.625rem;
      background: #f5f3f0;
      border: 1px solid #0a0a0a;
      display: inline-block;
      margin: 0.125rem;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      color: #0a0a0a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .button-group {
      display: flex;
      gap: 0.75rem;
      margin-top: 1.5rem;
      flex-wrap: wrap;
    }

    .button {
      padding: 0.875rem 1.5rem;
      border: 3px solid #0a0a0a;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: all 0.15s ease-out;
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .button-primary {
      background: #e63946;
      color: #ffffff;
      border-color: #e63946;
    }

    .button-primary:hover:not(:disabled) {
      background: #0a0a0a;
      border-color: #0a0a0a;
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 #e63946;
    }

    .button-danger {
      background: #ef4444;
      color: #ffffff;
      border-color: #ef4444;
    }

    .button-danger:hover:not(:disabled) {
      background: #0a0a0a;
      border-color: #0a0a0a;
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 #ef4444;
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
      box-shadow: 6px 6px 0 #78746c;
    }

    .status-message {
      text-align: center;
      padding: 3rem 1rem;
      font-family: 'Space Mono', monospace;
      font-size: 0.875rem;
      color: #78746c;
      position: relative;
      z-index: 1;
    }

    .loading-spinner {
      display: inline-block;
      width: 2rem;
      height: 2rem;
      border: 3px solid #e8e6e1;
      border-top-color: #e63946;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-message {
      padding: 1rem;
      background: #0a0a0a;
      border: 2px solid #e63946;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      color: #e63946;
      margin-bottom: 1rem;
      position: relative;
      z-index: 1;
    }

    .error-message::before {
      content: '[ ERROR ]';
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }

    .success-message {
      padding: 1rem;
      background: #0a0a0a;
      border: 2px solid #2d6a4f;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      color: #2d6a4f;
      margin-bottom: 1rem;
      position: relative;
      z-index: 1;
    }

    .success-message::before {
      content: '[ SUCCESS ]';
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }

    @media (max-width: 640px) {
      .container {
        padding: 1rem;
      }

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
        <!-- Japanese character decorations -->
        <div class="japanese-deco top">設</div>
        <div class="japanese-deco bottom">定</div>

        <a href="/" class="home-link">← Back to Home</a>

        <h1>Settings</h1>

        ${this.renderMessages()}

        ${this.loading ? html`
          <div class="status-message">
            <div class="loading-spinner"></div>
            <div>Loading settings...</div>
          </div>
        ` : html`
          ${this.renderYouTubeSection()}
        `}
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

  private renderButtonsDisconnected() {
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
