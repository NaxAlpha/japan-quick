/**
 * Shared CSS styles for all page components
 * Tokyo Editorial Cyber-Industrial aesthetic
 *
 * These styles use Lit CSS template literals for composition
 * Import and use in component static styles via array composition:
 * static styles = [baseStyles, buttonStyles, badgeStyles, css`...page-specific...`];
 */

import { css } from 'lit';

export const baseStyles = css`
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Zen+Tokyo+Zoo&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Inter:wght@400;500;600;700;800&display=swap');

  :host {
    display: block;
    width: 100%;
    min-height: 100vh;
  }

  .container {
    padding: 2rem;
    max-width: 1200px;
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

  /* Japanese character decorations */
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

  /* Navigation links */
  .home-link,
  .back-link {
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
    margin-bottom: 1.5rem;
    position: relative;
    z-index: 1;
  }

  .home-link:hover,
  .back-link:hover {
    background: #e63946;
    border-color: #e63946;
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 #0a0a0a;
  }

  /* Typography */
  h1 {
    font-family: 'Zen Tokyo Zoo', sans-serif;
    font-size: clamp(1.75rem, 5vw, 2.5rem);
    font-weight: 400;
    line-height: 1.1;
    color: #0a0a0a;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  h1 .accent {
    color: #e63946;
  }
`;

export const buttonStyles = css`
  .btn,
  .button,
  .trigger-button,
  .load-more-button,
  .scrape-button {
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
    background: #0a0a0a;
    color: #ffffff;
  }

  .btn:hover:not(:disabled),
  .button:hover:not(:disabled),
  .trigger-button:hover:not(:disabled),
  .load-more-button:hover:not(:disabled),
  .scrape-button:hover:not(:disabled) {
    background: #e63946;
    border-color: #e63946;
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 #0a0a0a;
  }

  .btn:focus-visible,
  .button:focus-visible,
  .trigger-button:focus-visible,
  .load-more-button:focus-visible,
  .scrape-button:focus-visible {
    outline: 3px solid #e63946;
    outline-offset: 3px;
  }

  .btn:disabled,
  .button:disabled,
  .trigger-button:disabled,
  .load-more-button:disabled,
  .scrape-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: 4px 4px 0 #0a0a0a;
  }

  .btn-primary,
  .button-primary,
  .trigger-button,
  .scrape-button {
    background: #e63946;
    border-color: #e63946;
  }

  .btn-primary:hover:not(:disabled),
  .button-primary:hover:not(:disabled) {
    background: #0a0a0a;
    border-color: #0a0a0a;
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 #e63946;
  }

  .btn-success,
  .button-success {
    background: #2d6a4f;
    border-color: #2d6a4f;
  }

  .btn-success:hover:not(:disabled),
  .button-success:hover:not(:disabled) {
    background: #0a0a0a;
    border-color: #0a0a0a;
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 #2d6a4f;
  }

  .btn-secondary,
  .button-secondary {
    background: #78746c;
    border-color: #78746c;
    color: #ffffff;
  }

  .btn-secondary:hover:not(:disabled),
  .button-secondary:hover:not(:disabled) {
    background: #0a0a0a;
    border-color: #0a0a0a;
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 #78746c;
  }

  .btn-danger,
  .button-danger {
    background: #ef4444;
    border-color: #ef4444;
    color: #ffffff;
  }

  .btn-danger:hover:not(:disabled),
  .button-danger:hover:not(:disabled) {
    background: #0a0a0a;
    border-color: #0a0a0a;
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 #ef4444;
  }
`;

export const badgeStyles = css`
  .badge,
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

  .badge.new,
  .status-badge.new {
    background: #e63946;
    color: #ffffff;
    border-color: #e63946;
  }

  .badge.external,
  .status-badge.external {
    background: #78746c;
    color: #ffffff;
    border-color: #78746c;
  }

  .badge.pending,
  .status-badge.pending {
    background: #e9c46a;
    color: #78350f;
    border-color: #e9c46a;
  }

  .badge.scraped-v1,
  .status-badge.scraped-v1 {
    background: #0066cc;
    color: #ffffff;
    border-color: #0066cc;
  }

  .badge.scraped-v2,
  .status-badge.scraped-v2 {
    background: #2d6a4f;
    color: #ffffff;
    border-color: #2d6a4f;
  }

  .badge.not-available,
  .status-badge.not-available {
    background: #78746c;
    color: #ffffff;
    border-color: #78746c;
  }

  .badge.retry-1,
  .badge.retry-2,
  .status-badge.retry-1,
  .status-badge.retry-2 {
    background: #f97316;
    color: #ffffff;
    border-color: #f97316;
  }

  .badge.error,
  .status-badge.error {
    background: #ef4444;
    color: #ffffff;
    border-color: #ef4444;
  }

  .badge.connected,
  .status-badge.connected {
    background: #2d6a4f;
    color: #ffffff;
    border-color: #2d6a4f;
  }

  .badge.not-connected,
  .status-badge.not-connected {
    background: #78746c;
    color: #ffffff;
    border-color: #78746c;
  }

  .badge.type-short {
    background: #e63946;
    color: #ffffff;
    border-color: #e63946;
  }

  .badge.type-long {
    background: #0a0a0a;
    color: #ffffff;
    border-color: #0a0a0a;
  }

  .badge.selection-todo {
    background: #e9c46a;
    color: #78350f;
    border-color: #e9c46a;
  }

  .badge.selection-doing {
    background: #0066cc;
    color: #ffffff;
    border-color: #0066cc;
  }

  .badge.selection-done {
    background: #2d6a4f;
    color: #ffffff;
    border-color: #2d6a4f;
  }

  .badge.script-pending,
  .badge.asset-pending {
    background: #f5f3f0;
    color: #58544c;
  }

  .badge.script-generating,
  .badge.asset-generating {
    background: #0066cc;
    color: #ffffff;
    border-color: #0066cc;
  }

  .badge.script-generated,
  .badge.asset-generated {
    background: #2d6a4f;
    color: #ffffff;
    border-color: #2d6a4f;
  }

  .badge.script-error,
  .badge.asset-error {
    background: #0a0a0a;
    color: #e63946;
    border-color: #e63946;
  }

  .badge.render-pending {
    background: #f5f3f0;
    color: #58544c;
  }

  .badge.render-rendering {
    background: #0066cc;
    color: #ffffff;
    border-color: #0066cc;
  }

  .badge.render-rendered {
    background: #2d6a4f;
    color: #ffffff;
    border-color: #2d6a4f;
  }

  .badge.render-error {
    background: #0a0a0a;
    color: #e63946;
    border-color: #e63946;
  }

  .badge.youtube-pending {
    background: #f5f3f0;
    color: #58544c;
  }

  .badge.youtube-uploading {
    background: #0066cc;
    color: #ffffff;
    border-color: #0066cc;
  }

  .badge.youtube-processing {
    background: #f97316;
    color: #ffffff;
    border-color: #f97316;
  }

  .badge.youtube-uploaded {
    background: #ff0000;
    color: #ffffff;
    border-color: #ff0000;
  }

  .badge.youtube-error {
    background: #0a0a0a;
    color: #e63946;
    border-color: #e63946;
  }
`;

export const loadingStyles = css`
  .loading-spinner {
    display: inline-block;
    width: 2rem;
    height: 2rem;
    border: 3px solid #e8e6e1;
    border-top-color: #e63946;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading,
  .status-message,
  .loading-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    text-align: center;
    padding: 3rem 2rem;
    font-family: 'Space Mono', monospace;
    font-size: 0.875rem;
    color: #78746c;
    position: relative;
    z-index: 1;
  }

  .loading-row {
    flex-direction: row;
    padding: 1rem;
  }

  .status-message.error,
  .error,
  .error-message {
    color: #e63946;
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

  .polling-status {
    padding: 0.75rem;
    background: rgba(230, 57, 70, 0.1);
    border: 2px solid #e63946;
    font-family: 'Space Mono', monospace;
    font-size: 0.75rem;
    color: #e63946;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .polling-status::before {
    content: '';
    width: 8px;
    height: 8px;
    background: #e63946;
    border-radius: 50%;
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }
`;
