/**
 * Retry Helper - Provides retry logic with exponential backoff
 * Common patterns:
 * - Retry loops with attempt tracking
 * - Exponential backoff for retries
 * - Status updates during retries
 * - Error handling with max attempts
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  backoffFactor?: number;
  statusUpdateCallback?: (attempt: number, error: string) => Promise<void>;
}

/**
 * Execute a function with retry logic
 * @param reqId Request ID for logging
 * @param operationName Name of the operation for logging
 * @param callback Function to execute
 * @param config Retry configuration
 * @returns Result of the successful operation
 */
export async function withRetry<T>(
  reqId: string,
  operationName: string,
  callback: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: string = '';

  for (let attempt = 0; attempt <= config.maxAttempts; attempt++) {
    try {
      // Execute the operation
      const result = await callback();

      // Success - log and return
      if (attempt > 0) {
        console.log(`[${reqId}] Retry success on attempt ${attempt + 1} for ${operationName}`);
      }
      return result;

    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.warn(`[${reqId}] ${operationName} attempt ${attempt + 1} failed: ${lastError}`);

      // Update status if callback provided
      if (config.statusUpdateCallback && attempt < config.maxAttempts) {
        await config.statusUpdateCallback(attempt, lastError);
      }

      // Calculate delay with exponential backoff
      const delay = config.baseDelayMs * Math.pow(config.backoffFactor || 2, attempt);

      // Wait before next retry (except for last attempt)
      if (attempt < config.maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All attempts failed
  throw new Error(`${operationName} failed after ${config.maxAttempts} attempts: ${lastError}`);
}

/**
 * Sleep utility for delaying execution
 * @param ms Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate retry status based on attempt number
 * @param attempt Attempt number (0-indexed)
 * @returns Retry status string
 */
export function getRetryStatus(attempt: number): 'retry_1' | 'retry_2' {
  return attempt === 0 ? 'retry_1' : 'retry_2';
}
