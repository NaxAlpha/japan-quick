/**
 * Settings page component - Application settings
 * Displays YouTube authentication status and allows connection/disconnection
 *
 * Tokyo Cyber-Industrial aesthetic
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getAuthHeaders } from '../lib/auth.js';
import { baseStyles, buttonStyles, badgeStyles, loadingStyles } from '../styles/shared-styles.js';
import '../components/youtube-oauth-status-card.js';
import '../components/youtube-channel-info-card.js';
import '../components/youtube-token-controls.js';

@customElement('settings-page')
export class SettingsPage extends LitElement {
  static styles = [baseStyles, buttonStyles, badgeStyles, loadingStyles, css`
    .container {
      max-width: 800px;
    }
  `];

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
    // Component now uses child components to fetch status
    // We just wait for initial render
    await new Promise(resolve => setTimeout(resolve, 100));
    this.loading = false;
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
    return html`
      <youtube-oauth-status-card></youtube-oauth-status-card>
      <youtube-channel-info-card></youtube-channel-info-card>
      <youtube-token-controls></youtube-token-controls>
    `;
  }

}
