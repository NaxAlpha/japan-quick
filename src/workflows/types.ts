/**
 * Workflow type definitions for Cloudflare Workflows
 */

import type { YahooNewsResponse } from '../types/news.js';

// NewsScraperWorkflow input parameters
export interface NewsScraperParams {
  skipCache?: boolean;
}

// NewsScraperWorkflow result
export interface NewsScraperResult {
  success: boolean;
  data?: YahooNewsResponse;
  snapshotName?: string;
  error?: string;
}

// ScheduledNewsRefreshWorkflow has no input parameters (triggered by cron)
export interface ScheduledRefreshParams {
  // Empty - cron triggered
}

// ScheduledNewsRefreshWorkflow result
export interface ScheduledRefreshResult {
  success: boolean;
  data?: YahooNewsResponse;
  snapshotName?: string;
  scrapedCount?: number;
  error?: string;
}

// Step configuration for retry policies
export interface StepRetryConfig {
  limit: number;
  delay: string;
  backoff?: 'exponential' | 'linear';
}
