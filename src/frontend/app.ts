import { LitElement, html, css } from 'lit';
import { state } from 'lit/decorators.js';

/**
 * Root application component for Japan Quick
 *
 * Tokyo Editorial Cyber-Industrial aesthetic
 * Bold typography, high contrast, Japanese design influences
 */

export class AppRoot extends LitElement {
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

        .japanese-deco.right {
            top: 50%;
            right: -5%;
            transform: translateY(-50%) rotate(5deg);
        }

        /* Hero section */
        .hero {
            text-align: center;
            max-width: 800px;
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

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: #0a0a0a;
            color: #e63946;
            font-family: 'Space Mono', monospace;
            font-size: 0.6875rem;
            font-weight: 400;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            border: 2px solid #0a0a0a;
            margin-bottom: 2rem;
        }

        .badge-dot {
            width: 6px;
            height: 6px;
            background: #e63946;
            border-radius: 50%;
            animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
        }

        h1 {
            font-family: 'Zen Tokyo Zoo', sans-serif;
            font-size: clamp(3rem, 12vw, 8rem);
            font-weight: 400;
            line-height: 0.95;
            color: #0a0a0a;
            margin: 0 0 1.5rem 0;
            letter-spacing: -0.02em;
            text-transform: uppercase;
        }

        h1 .accent {
            color: #e63946;
        }

        .subtitle {
            font-family: 'Inter', 'Noto Sans JP', sans-serif;
            font-size: clamp(1rem, 2.5vw, 1.25rem);
            font-weight: 500;
            color: #58544c;
            max-width: 500px;
            margin: 0 auto 3rem;
            line-height: 1.6;
        }

        /* Navigation grid */
        .nav-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
            width: 100%;
            max-width: 700px;
        }

        @media (max-width: 640px) {
            .nav-grid {
                grid-template-columns: 1fr;
            }
        }

        .nav-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.75rem;
            padding: 2rem 1.5rem;
            background: #ffffff;
            border: 3px solid #0a0a0a;
            text-decoration: none;
            color: #0a0a0a;
            transition: all 0.15s ease-out;
            box-shadow: 4px 4px 0 #0a0a0a;
            position: relative;
            overflow: hidden;
        }

        .nav-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: #e63946;
            transform: scaleX(0);
            transform-origin: left;
            transition: transform 0.2s ease-out;
        }

        .nav-card:hover {
            transform: translate(-2px, -2px);
            box-shadow: 6px 6px 0 #0a0a0a;
        }

        .nav-card:hover::before {
            transform: scaleX(1);
        }

        .nav-card:active {
            transform: translate(0, 0);
            box-shadow: 2px 2px 0 #0a0a0a;
        }

        .nav-icon {
            font-size: 2rem;
            line-height: 1;
        }

        .nav-label {
            font-family: 'Inter', sans-serif;
            font-size: 0.875rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        /* Test section */
        .test-section {
            margin-top: 3rem;
            width: 100%;
            max-width: 500px;
        }

        .test-button {
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

        .test-button:hover:not(:disabled) {
            background: #e63946;
            border-color: #e63946;
            transform: translate(-2px, -2px);
            box-shadow: 6px 6px 0 #0a0a0a;
        }

        .test-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
            box-shadow: 4px 4px 0 #0a0a0a;
        }

        .result {
            margin-top: 1rem;
            padding: 1rem;
            background: #0a0a0a;
            color: #e63946;
            border: 2px solid #0a0a0a;
            font-family: 'Space Mono', monospace;
            font-size: 0.75rem;
            min-height: 3rem;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow-x: auto;
        }

        .result pre {
            margin: 0;
            white-space: pre-wrap;
            word-break: break-all;
        }

        .loading {
            opacity: 0.7;
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

        .footer a {
            color: #e63946;
            text-decoration: none;
        }

        .footer a:hover {
            text-decoration: underline;
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
                <!-- Scrolling ticker -->
                <div class="ticker">
                    <div class="ticker-content">
                        AI-POWERED VIDEO GENERATION /// YOUTUBE SHORTS & LONG-FORM CONTENT /// JAPANESE NEWS SOURCES /// AUTOMATED WORKFLOWS ///
                        AI-POWERED VIDEO GENERATION /// YOUTUBE SHORTS & LONG-FORM CONTENT /// JAPANESE NEWS SOURCES /// AUTOMATED WORKFLOWS ///
                    </div>
                </div>

                <!-- Japanese character decorations -->
                <div class="japanese-deco left">速</div>
                <div class="japanese-deco right">映</div>

                <!-- Main content -->
                <div class="content">
                    <div class="hero">
                        <span class="badge">
                            <span class="badge-dot"></span>
                            System Online
                        </span>

                        <h1>Japan<span class="accent">Quick</span></h1>
                        <p class="subtitle">
                            AI-powered video generation platform. Transform Japanese news into engaging YouTube content automatically.
                        </p>

                        <div class="nav-grid">
                            <a href="/news" class="nav-card">
                                <span class="nav-icon">📰</span>
                                <span class="nav-label">News Feed</span>
                            </a>
                            <a href="/videos" class="nav-card">
                                <span class="nav-icon">🎬</span>
                                <span class="nav-label">Videos</span>
                            </a>
                            <a href="/settings" class="nav-card">
                                <span class="nav-icon">⚙️</span>
                                <span class="nav-label">Settings</span>
                            </a>
                        </div>
                    </div>

                    <div class="test-section">
                        <button
                            class="test-button"
                            @click=${this.testApi}
                            ?disabled=${this.loading}
                        >
                            ${this.loading ? '[ PROCESSING... ]' : '[ Test API Connection ]'}
                        </button>
                        <div class="result">
                            ${this.loading
                                ? html`<span class="loading">> Awaiting response...</span>`
                                : this.apiResult
                                ? html`<pre>${this.apiResult}</pre>`
                                : html`<span style="opacity: 0.5">> Click to test API connection</span>`}
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <footer class="footer">
                    <span>Japan Quick /// v1.0.0 /// </span>
                    <a href="https://github.com" target="_blank">Source</a>
                </footer>
            </div>
        `;
    }
}

// Register the custom element
customElements.define('app-root', AppRoot);
