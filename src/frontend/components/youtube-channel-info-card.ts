/**
 * YouTube channel info card component
 * Displays connected channel details, token info, and scopes
 */
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getAuthHeaders } from '../lib/auth.js';
import { baseStyles, badgeStyles, loadingStyles } from '../styles/shared-styles.js';

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

@customElement('youtube-channel-info-card')
export class YouTubeChannelInfoCard extends LitElement {
  static styles = [baseStyles, badgeStyles, loadingStyles, css`
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

    @media (max-width: 640px) {
      .channel-info {
        padding: 1rem;
      }
    }
  `];

  @state()
  private authStatus: YouTubeAuthStatus | null = null;

  @state()
  private loading: boolean = true;

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
        this.authStatus = data.data;
      }
    } catch (err) {
      console.error('Failed to load YouTube status:', err);
    } finally {
      this.loading = false;
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

  private formatScope(scope: string): string {
    const scopeNames: Record<string, string> = {
      'https://www.googleapis.com/auth/youtube.upload': 'Upload Videos',
      'https://www.googleapis.com/auth/youtube': 'Manage Account',
      'https://www.googleapis.com/auth/yt-analytics.readonly': 'View Analytics',
    };
    return scopeNames[scope] || scope;
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading-row">
          <span class="loading-spinner"></span>
          <span>Loading channel info...</span>
        </div>
      `;
    }

    const isConnected = this.authStatus?.isConnected;

    if (!isConnected || !this.authStatus?.channel) {
      return html`
        <p class="no-content">Not connected</p>
      `;
    }

    const channel = this.authStatus.channel;
    const expiresIn = this.authStatus.tokenExpiresIn;
    const expiryText = this.formatTokenExpires(expiresIn);
    const expiryClass = this.getTokenExpiryClass(expiresIn);

    return html`
      <div class="channel-info">
        <p class="channel-name">${channel.title}</p>
        <p class="channel-id">Channel ID: ${channel.id}</p>

        <div class="token-info">
          <div class="token-info-row ${expiryClass}">
            <span>Token expires in:</span>
            <span>${expiryText}</span>
          </div>
        </div>

        ${this.authStatus.scopes && this.authStatus.scopes.length > 0 ? html`
          <div class="scopes-list">
            <p class="scopes-title">Permissions granted:</p>
            ${this.authStatus.scopes.map(scope => html`
              <span class="scope-item">${this.formatScope(scope)}</span>
            `)}
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'youtube-channel-info-card': YouTubeChannelInfoCard;
  }
}
