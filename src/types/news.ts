/**
 * Type definitions for Yahoo News Japan scraper
 */

export interface YahooNewsTopPick {
  title: string;
  url: string;
  thumbnailUrl?: string;
  publishedAt?: string; // e.g., "1/19(月) 12:31"
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

/**
 * Cloudflare Browser binding type
 * Used for Puppeteer-based scraping in production
 */
export interface BrowserBinding {
  newPage(): Promise<Page>;
}

export interface Page {
  setUserAgent(userAgent: string): Promise<void>;
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
  close(): Promise<void>;
}

// Env type for Cloudflare Workers bindings
export type Env = {
  Bindings: {
    ADMIN_USERNAME: string;
    ADMIN_PASSWORD: string;
    BROWSER: BrowserBinding | null;
    NEWS_CACHE: KVNamespace;
    DB: D1Database;
    NEWS_SCRAPER_WORKFLOW: Workflow;
    SCHEDULED_REFRESH_WORKFLOW: Workflow;
  }
};
