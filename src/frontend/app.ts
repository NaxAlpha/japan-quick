import { LitElement, html, css } from 'lit';

/**
 * Root application component for Japan Quick
 *
 * This component serves as the main entry point for the frontend application.
 * It renders the Japan Quick branding with information about AI-powered YouTube shorts generation.
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

    render() {
        return html`
            <div class="container">
                <div class="content">
                    <h1>Japan Quick</h1>
                    <p>AI-powered YouTube shorts generation</p>
                    <span class="badge">Powered by AI</span>
                </div>
            </div>
        `;
    }
}

// Register the custom element
customElements.define('app-root', AppRoot);
