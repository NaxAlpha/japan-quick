/**
 * Type definitions for Yahoo News Japan scraper
 */

import type { ArticleStatus } from './article.js';

export interface YahooNewsTopPick {
  title: string;
  url: string;
  thumbnailUrl?: string;
  publishedAt?: string; // e.g., "1/19(月) 12:31"
  pickId?: string; // Extracted pickup ID from URL
  articleStatus?: ArticleStatus; // Status from articles table
}

export interface YahooNewsResponse {
  topPicks: YahooNewsTopPick[];
  scrapedAt: string;
  cached: boolean;
}

// D1 snapshot interface
export interface NewsSnapshot {
  id: number; // Auto-increment INTEGER
  capturedAt: string; // ISO timestamp
  snapshotName: string; // e.g., "article-snapshot-2026-01-19-14-30-45"
  data: string; // JSON string of YahooNewsResponse
}
