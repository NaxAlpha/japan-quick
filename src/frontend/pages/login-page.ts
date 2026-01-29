/**
 * Login Page Component
 * Tokyo Cyber-Industrial aesthetic login form
 */

import { LitElement, html, css } from 'lit';
import { state } from 'lit/decorators.js';
import { login, type LoginCredentials } from '../lib/auth.js';

export class LoginPage extends LitElement {
  static styles = css`
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Zen+Tokyo+Zoo&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Inter:wght@400;500;600;700;800&display=swap');

    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
    }

    * {
      box-sizing: border-box;
    }

    .container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: #f5f3f0;
      position: relative;
      overflow: hidden;
    }

    /* Japanese wave pattern overlay */
    .container::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: url("data:image/svg+xml,%3Csvg width='120' height='60' viewBox='0 0 120 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 30 Q 15 15, 30 30 T 60 30 T 90 30 T 120 30' stroke='%23e63946' stroke-width='0.5' fill='none' opacity='0.08'/%3E%3C/svg%3E");
      background-size: 120px 60px;
      pointer-events: none;
      z-index: 0;
    }

    /* Scrolling ticker */
    .ticker {
      background: #0a0a0a;
      color: #e63946;
      padding: 0.5rem 0;
      overflow: hidden;
      white-space: nowrap;
      position: relative;
      z-index: 1;
      border-bottom: 3px solid #e63946;
    }

    .ticker-content {
      display: inline-block;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      font-weight: 400;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      animation: marquee 20s linear infinite;
    }

    @keyframes marquee {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    .content {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      position: relative;
      z-index: 1;
    }

    /* Large Japanese character decoration */
    .japanese-deco {
      position: fixed;
      font-family: 'Zen Tokyo Zoo', sans-serif;
      font-size: clamp(15rem, 40vw, 40rem);
      color: rgba(230, 57, 70, 0.04);
      line-height: 1;
      pointer-events: none;
      z-index: 0;
      user-select: none;
    }

    .japanese-deco.left {
      top: 50%;
      left: -5%;
      transform: translateY(-50%) rotate(-5deg);
    }

    /* Login form container */
    .login-container {
      width: 100%;
      max-width: 400px;
      animation: slideUp 0.8s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(40px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .title {
      text-align: center;
      margin-bottom: 2rem;
    }

    h1 {
      font-family: 'Zen Tokyo Zoo', sans-serif;
      font-size: clamp(2.5rem, 8vw, 4rem);
      font-weight: 400;
      line-height: 0.95;
      color: #0a0a0a;
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.02em;
      text-transform: uppercase;
    }

    h1 .accent {
      color: #e63946;
    }

    .subtitle {
      font-family: 'Inter', 'Noto Sans JP', sans-serif;
      font-size: 0.875rem;
      font-weight: 500;
      color: #58544c;
      margin: 0;
    }

    /* Form styles */
    .form {
      background: #ffffff;
      border: 3px solid #0a0a0a;
      padding: 2rem;
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    label {
      display: block;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: #0a0a0a;
      margin-bottom: 0.5rem;
    }

    input {
      width: 100%;
      padding: 0.75rem 1rem;
      background: #ffffff;
      color: #0a0a0a;
      border: 2px solid #0a0a0a;
      font-family: 'Inter', sans-serif;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.15s ease-out;
    }

    input:focus {
      outline: none;
      border-color: #e63946;
      box-shadow: 0 0 0 3px rgba(230, 57, 70, 0.1);
    }

    input:disabled {
      background: #f5f3f0;
      cursor: not-allowed;
      opacity: 0.6;
    }

    /* Submit button */
    .submit-button {
      width: 100%;
      padding: 1rem;
      background: #0a0a0a;
      color: #ffffff;
      border: 3px solid #0a0a0a;
      font-family: 'Space Mono', monospace;
      font-size: 0.875rem;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: all 0.15s ease-out;
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    .submit-button:hover:not(:disabled) {
      background: #e63946;
      border-color: #e63946;
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 #0a0a0a;
    }

    .submit-button:active:not(:disabled) {
      transform: translate(0, 0);
      box-shadow: 2px 2px 0 #0a0a0a;
    }

    .submit-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: 4px 4px 0 #0a0a0a;
    }

    /* Error message */
    .error {
      margin-top: 1rem;
      padding: 0.75rem 1rem;
      background: #e63946;
      color: #ffffff;
      border: 2px solid #e63946;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      animation: shake 0.3s ease-out;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }

    .error-icon {
      font-size: 1rem;
    }

    /* Footer */
    .footer {
      padding: 1.5rem 2rem;
      background: #0a0a0a;
      color: #78746c;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      text-align: center;
      position: relative;
      z-index: 1;
    }
  `;

  @state()
  private username = '';

  @state()
  private password = '';

  @state()
  private loading = false;

  @state()
  private error: string | null = null;

  private handleSubmit = async (e: Event) => {
    e.preventDefault();
    this.loading = true;
    this.error = null;

    const credentials: LoginCredentials = {
      username: this.username,
      password: this.password
    };

    try {
      await login(credentials);

      // Get return URL from query param, default to home
      const urlParams = new URLSearchParams(window.location.search);
      const returnUrl = urlParams.get('return') || '/';

      // Prevent open redirect: only allow relative paths starting with /
      if (!returnUrl.startsWith('/')) {
        this.error = 'Invalid return URL';
        return;
      }

      // Redirect to return URL
      window.location.href = returnUrl;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Login failed. Please try again.';
    } finally {
      this.loading = false;
    }
  };

  render() {
    return html`
      <div class="container">
        <!-- Scrolling ticker -->
        <div class="ticker">
          <div class="ticker-content">
            AUTHENTICATION REQUIRED /// JAPAN QUICK /// SECURE ACCESS ///
            AUTHENTICATION REQUIRED /// JAPAN QUICK /// SECURE ACCESS ///
          </div>
        </div>

        <!-- Japanese character decorations -->
        <div class="japanese-deco left">認</div>

        <!-- Main content -->
        <div class="content">
          <div class="login-container">
            <div class="title">
              <h1>Japan<span class="accent">Quick</span></h1>
              <p class="subtitle">Please enter your credentials to continue</p>
            </div>

            <form class="form" @submit=${this.handleSubmit}>
              <div class="form-group">
                <label for="username">Username</label>
                <input
                  id="username"
                  type="text"
                  name="username"
                  .value=${this.username}
                  @input=${(e: InputEvent) => {
                    this.username = (e.target as HTMLInputElement).value;
                    this.error = null;
                  }}
                  ?disabled=${this.loading}
                  autocomplete="username"
                  required
                  autofocus
                />
              </div>

              <div class="form-group">
                <label for="password">Password</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  .value=${this.password}
                  @input=${(e: InputEvent) => {
                    this.password = (e.target as HTMLInputElement).value;
                    this.error = null;
                  }}
                  ?disabled=${this.loading}
                  autocomplete="current-password"
                  required
                />
              </div>

              <button
                type="submit"
                class="submit-button"
                ?disabled=${this.loading}
              >
                ${this.loading ? '[ AUTHENTICATING... ]' : '[ LOGIN ]'}
              </button>

              ${this.error ? html`
                <div class="error">
                  <span class="error-icon">!</span>
                  <span>${this.error}</span>
                </div>
              ` : ''}
            </form>
          </div>
        </div>

        <!-- Footer -->
        <footer class="footer">
          Japan Quick /// v1.0.0 /// JWT Authentication
        </footer>
      </div>
    `;
  }
}

customElements.define('login-page', LoginPage);
