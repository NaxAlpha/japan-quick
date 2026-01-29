/**
 * Polling utility for frontend components
 * Provides consistent polling pattern across pages with automatic cleanup
 */

import { getAuthHeaders, handleUnauthorized } from './auth.js';

export interface PollingConfig {
  /** Function that returns the endpoint URL to poll */
  getEndpoint: () => string;
  /** Polling interval in milliseconds */
  intervalMs: number;
  /** States that indicate polling should stop (terminal states) */
  terminalStates: string[];
  /** Callback when status is received */
  onStatus: (status: string, data: unknown) => void;
  /** Callback when polling completes (reached terminal state) - receives the terminal status */
  onComplete: (terminalStatus: string, data: unknown) => void;
  /** Optional callback when polling encounters an error */
  onError?: (error: Error) => void;
  /** Optional auth headers - if not provided, uses getAuthHeaders() */
  getAuthHeaders?: () => Record<string, string>;
}

export interface Poller {
  /** Start polling */
  start: () => void;
  /** Stop polling and cleanup interval */
  stop: () => void;
  /** Check if poller is currently running */
  isRunning: () => boolean;
}

/**
 * Creates a poller instance for checking status endpoints
 *
 * @example
 * ```typescript
 * const poller = createPoller({
 *   getEndpoint: () => `/api/videos/${this.videoId}/script/status`,
 *   intervalMs: 2500,
 *   terminalStates: ['generated', 'error'],
 *   onStatus: (status, data) => this.handleScriptStatus(status, data),
 *   onComplete: (terminalStatus, data) => {
 *   if (terminalStatus === 'generated') {
 *     this.loadVideo();
 *   } else {
 *     this.showError('Generation failed');
 *   }
 *   },
 *   onError: (err) => this.error = err.message
 * });
 *
 * // Start polling
 * poller.start();
 *
 * // Clean up on disconnect
 * disconnectedCallback() {
 *   poller.stop();
 *   super.disconnectedCallback();
 * }
 * ```
 */
export function createPoller(config: PollingConfig): Poller {
  let intervalId: number | null = null;

  const poll = async () => {
    try {
      const endpoint = config.getEndpoint();
      const headers = config.getAuthHeaders ? config.getAuthHeaders() : getAuthHeaders();

      const response = await fetch(endpoint, { headers });

      // Handle 401 Unauthorized - redirect to login
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Request failed');
      }

      const status = data.status;

      // Call status callback
      config.onStatus(status, data);

      // Check if we've reached a terminal state
      if (config.terminalStates.includes(status)) {
        poller.stop();
        config.onComplete(status, data);
      }
    } catch (err) {
      poller.stop();
      if (config.onError) {
        config.onError(err instanceof Error ? err : new Error('Polling failed'));
      }
    }
  };

  const poller: Poller = {
    start(): void {
      // Stop any existing polling first
      this.stop();

      // Start new polling interval
      intervalId = window.setInterval(poll, config.intervalMs);

      // Immediate first poll
      poll();
    },

    stop(): void {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },

    isRunning(): boolean {
      return intervalId !== null;
    }
  };

  return poller;
}
