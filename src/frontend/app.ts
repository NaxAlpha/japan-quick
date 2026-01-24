import { LitElement, html, css } from 'lit';
import { state } from 'lit/decorators.js';

/**
 * Root application component for Japan Quick
 *
 * This component serves as the main entry point for the frontend application.
 * It renders the Japan Quick branding with information about AI-powered video generation
 * for both YouTube shorts and long-form content.
 */
export class AppRoot extends LitElement {
    static styles = css`
        :host {
            display: block;
            width: 100%;
            min-height: 100vh;
        }

        .container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 2rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .content {
            text-align: center;
            animation: fadeIn 0.6s ease-in;
        }

        h1 {
            font-size: 3rem;
            font-weight: 700;
            margin-bottom: 1rem;
            letter-spacing: -0.025em;
        }

        p {
            font-size: 1.25rem;
            opacity: 0.9;
            margin-bottom: 2rem;
        }

        .badge {
            display: inline-block;
            padding: 0.5rem 1rem;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 500;
            backdrop-filter: blur(10px);
        }

        .navigation-section {
            margin-top: 3rem;
            display: flex;
            gap: 1rem;
            justify-content: center;
        }

        .nav-button {
            padding: 0.75rem 1.5rem;
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 0.5rem;
            color: white;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
            text-decoration: none;
        }

        .nav-button:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        button {
            padding: 0.75rem 1.5rem;
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 0.5rem;
            color: white;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
        }

        button:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.3);
        }

        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .test-section {
            margin-top: 3rem;
        }

        .result {
            margin-top: 1.5rem;
            padding: 1rem;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 0.5rem;
            font-family: monospace;
            font-size: 0.875rem;
            text-align: left;
            min-height: 3rem;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .loading {
            opacity: 0.7;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @media (max-width: 640px) {
            h1 {
                font-size: 2rem;
            }

            p {
                font-size: 1rem;
            }
        }
    `;

    @state()
    private loading = false;

    @state()
    private apiResult: string | null = null;

    private async testApi() {
        this.loading = true;
        this.apiResult = null;

        try {
            const response = await fetch('/api/hello');
            const data = await response.json();
            this.apiResult = JSON.stringify(data, null, 2);
        } catch (error) {
            this.apiResult = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        } finally {
            this.loading = false;
        }
    }

    render() {
        return html`
            <div class="container">
                <div class="content">
                    <h1>Japan Quick</h1>
                    <p>AI-powered video generation for YouTube Shorts & Long-form</p>
                    <span class="badge">Powered by AI</span>

                    <div class="navigation-section">
                        <a href="/news" class="nav-button">View Yahoo News Japan</a>
                        <a href="/videos" class="nav-button">View Videos</a>
                    </div>

                    <div class="test-section">
                        <button @click=${this.testApi} ?disabled=${this.loading}>
                            ${this.loading ? 'Loading...' : 'Test API'}
                        </button>
                        <div class="result">
                            ${this.loading
                                ? html`<span class="loading">Calling API...</span>`
                                : this.apiResult
                                ? html`<pre>${this.apiResult}</pre>`
                                : html`<span style="opacity: 0.5">Click to test API</span>`}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Register the custom element
customElements.define('app-root', AppRoot);
