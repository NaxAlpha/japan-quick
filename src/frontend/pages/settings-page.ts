/**
 * Settings page component - Application settings
 * Displays YouTube authentication status and allows connection/disconnection
 *
 * Tokyo Cyber-Industrial aesthetic
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { baseStyles, buttonStyles, badgeStyles, loadingStyles } from '../styles/shared-styles.js';
import '../components/youtube-oauth-status-card.js';

@customElement('settings-page')
export class SettingsPage extends LitElement {
  static styles = [baseStyles, buttonStyles, badgeStyles, loadingStyles, css`
    .container {
      max-width: 800px;
      position: relative;
      padding: 2rem 1rem;
    }

    .japanese-deco {
      position: fixed;
      font-family: 'Zen Tokyo Zoo', sans-serif;
      font-size: 15rem;
      color: #e8e6e1;
      pointer-events: none;
      z-index: 0;
      opacity: 0.3;
    }

    .japanese-deco.top {
      top: -2rem;
      left: -2rem;
    }

    .japanese-deco.bottom {
      bottom: -2rem;
      right: -2rem;
    }

    .home-link {
      display: inline-block;
      margin-bottom: 2rem;
      font-family: 'Space Mono', monospace;
      font-size: 0.875rem;
      color: #0a0a0a;
      text-decoration: none;
      letter-spacing: 0.05em;
      position: relative;
      z-index: 1;
    }

    .home-link:hover {
      color: #e63946;
    }

    h1 {
      font-family: 'Zen Tokyo Zoo', sans-serif;
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 400;
      color: #0a0a0a;
      margin: 0 0 2rem 0;
      position: relative;
      z-index: 1;
      text-transform: uppercase;
    }

    .error-message {
      margin-bottom: 1.5rem;
      position: relative;
      z-index: 1;
    }

    .success-message {
      margin-bottom: 1.5rem;
      position: relative;
      z-index: 1;
    }

    @media (max-width: 640px) {
      .japanese-deco {
        font-size: 8rem;
      }

      .japanese-deco.top {
        top: -1rem;
        left: -1rem;
      }

      .japanese-deco.bottom {
        bottom: -1rem;
        right: -1rem;
      }
    }
  `];

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
  }

  render() {
    return html`
      <div class="container">
        <!-- Japanese character decorations -->
        <div class="japanese-deco top">設</div>
        <div class="japanese-deco bottom">定</div>

        <a href="/" class="home-link">← Back to Home</a>

        <h1>Settings</h1>

        ${this.error ? html`<div class="error-message">${this.error}</div>` : ''}
        ${this.message ? html`<div class="success-message">${this.message}</div>` : ''}

        <youtube-oauth-status-card></youtube-oauth-status-card>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'settings-page': SettingsPage;
  }
}
