/**
 * Cloudflare Workers environment bindings
 * Single source of truth for all runtime bindings
 */

import type { Sandbox } from '@cloudflare/sandbox';

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

/**
 * Cloudflare Workers environment type
 * Defines all bindings available at runtime
 */
export type Env = {
  Bindings: {
    // Auth
    ADMIN_USERNAME: string;
    ADMIN_PASSWORD: string;
    // Storage
    NEWS_CACHE: KVNamespace;
    DB: D1Database;
    ASSETS_BUCKET: R2Bucket;
    ASSETS_PUBLIC_URL: string;
    // Browser
    BROWSER: BrowserBinding | null;
    // Workflows
    NEWS_SCRAPER_WORKFLOW: Workflow;
    SCHEDULED_REFRESH_WORKFLOW: Workflow;
    ARTICLE_SCRAPER_WORKFLOW: Workflow;
    ARTICLE_RESCRAPE_WORKFLOW: Workflow;
    VIDEO_SELECTION_WORKFLOW: Workflow;
    VIDEO_RENDER_WORKFLOW: Workflow;
    SCRIPT_GENERATION_WORKFLOW: Workflow;
    ASSET_GENERATION_WORKFLOW: Workflow;
    // Sandbox
    Sandbox: DurableObjectNamespace<Sandbox>;
    // Secrets
    GOOGLE_API_KEY: string;
    YOUTUBE_CLIENT_ID: string;
    YOUTUBE_CLIENT_SECRET: string;
    YOUTUBE_REDIRECT_URI: string;
  }
};
