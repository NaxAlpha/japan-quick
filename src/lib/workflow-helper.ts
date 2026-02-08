/**
 * Shared workflow types.
 * Keep this file narrow and explicit to avoid stale helper accumulation.
 */

export interface TokenUsageInfo {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  slideIndex?: number;
}
