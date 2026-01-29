/**
 * Configuration Constants
 *
 * Single source of truth for all magic numbers, strings, and configuration values.
 * Centralized for maintainability and consistency across the codebase.
 */

// ============================================================================
// Scraping Constants
// ============================================================================

export const SCRAPING = {
  // User agent for browser requests
  USER_AGENT: 'Mozilla/5.0 (compatible; JapanQuick/1.0)' as const,

  // Timeout for page loads and scraping operations
  TIMEOUT_MS: 30000 as number,

  // Timeout for news page scraping
  NEWS_TIMEOUT_MS: 20000 as number,

  // Delay between article scrapes in serial operations
  DELAY_BETWEEN_ARTICLES_MS: 10000 as number,

  // Maximum retry attempts for article scraping
  MAX_ARTICLE_RETRIES: 2 as number,

  // Retry delay multiplier (5s, 10s)
  RETRY_DELAY_MS: 5000 as number,
} as const;

// ============================================================================
// Polling Intervals (Frontend)
// ============================================================================

export const POLLING = {
  // News workflow status polling
  NEWS_POLL_INTERVAL_MS: 2000 as number,

  // Article status polling
  ARTICLE_POLL_INTERVAL_MS: 1000 as number,

  // Article retry polling
  ARTICLE_RETRY_POLL_INTERVAL_MS: 2000 as number,

  // Script generation status polling
  SCRIPT_POLL_INTERVAL_MS: 2500 as number,

  // Asset generation status polling
  ASSET_POLL_INTERVAL_MS: 3000 as number,

  // Video render status polling
  RENDER_POLL_INTERVAL_MS: 3000 as number,

  // Videos page workflow status polling
  VIDEOS_POLL_INTERVAL_MS: 3000 as number,

  // Stale status threshold (10 minutes)
  STALE_STATUS_THRESHOLD_MS: 600000 as number,
} as const;

// ============================================================================
// API Endpoints
// ============================================================================

export const API = {
  // News endpoints
  NEWS: {
    TRIGGER: '/api/news/trigger' as const,
    TRIGGER_REFRESH: '/api/news/trigger-refresh' as const,
    TRIGGER_RESCRAPE: '/api/news/trigger-rescrape' as const,
    STATUS: (id: string) => `/api/news/status/${id}` as const,
    RESULT: (id: string) => `/api/news/result/${id}` as const,
    LATEST: '/api/news/latest' as const,
    CANCEL: (id: string) => `/api/news/cancel/${id}` as const,
  },

  // Article endpoints
  ARTICLES: {
    BY_ID: (id: string) => `/api/articles/${id}` as const,
    VERSION: (id: string, version: number) => `/api/articles/${id}/version/${version}` as const,
    TRIGGER: (pickId: string) => `/api/articles/trigger/${pickId}` as const,
    STATUS: (workflowId: string) => `/api/articles/status/${workflowId}` as const,
  },

  // Video endpoints
  VIDEOS: {
    LIST: '/api/videos' as const,
    BY_ID: (id: string) => `/api/videos/${id}` as const,
    TRIGGER: '/api/videos/trigger' as const,
    STATUS: (workflowId: string) => `/api/videos/status/${workflowId}` as const,
    GENERATE_SCRIPT: (id: string) => `/api/videos/${id}/generate-script` as const,
    SCRIPT_STATUS: (id: string) => `/api/videos/${id}/script/status` as const,
    GENERATE_ASSETS: (id: string) => `/api/videos/${id}/generate-assets` as const,
    ASSETS_STATUS: (id: string) => `/api/videos/${id}/assets/status` as const,
    ASSET_BY_ID: (id: string, assetId: string) => `/api/videos/${id}/assets/${assetId}` as const,
    DELETE: (id: string) => `/api/videos/${id}` as const,
    RENDER: (id: string) => `/api/videos/${id}/render` as const,
    RENDER_STATUS: (id: string) => `/api/videos/${id}/render/status` as const,
  },

  // YouTube endpoints
  YOUTUBE: {
    STATUS: '/api/youtube/status' as const,
    AUTH_URL: '/api/youtube/auth/url' as const,
    OAUTH_CALLBACK: '/api/youtube/oauth/callback' as const,
    REFRESH: '/api/youtube/refresh' as const,
    DISCONNECT: '/api/youtube/auth' as const,
  },
} as const;

// ============================================================================
// Status Values
// ============================================================================

export const STATUS = {
  // Article statuses
  ARTICLE: {
    PENDING: 'pending' as const,
    NOT_AVAILABLE: 'not_available' as const,
    RETRY_1: 'retry_1' as const,
    RETRY_2: 'retry_2' as const,
    ERROR: 'error' as const,
    SCRAPPED_V1: 'scraped_v1' as const,
    SCRAPPED_V2: 'scraped_v2' as const,
  },

  // Video statuses
  VIDEO: {
    TODO: 'todo' as const,
    DOING: 'doing' as const,
    DONE: 'done' as const,
    ERROR: 'error' as const,
  },

  // Script statuses
  SCRIPT: {
    PENDING: 'pending' as const,
    GENERATING: 'generating' as const,
    GENERATED: 'generated' as const,
    ERROR: 'error' as const,
  },

  // Asset statuses
  ASSET: {
    PENDING: 'pending' as const,
    GENERATING: 'generating' as const,
    GENERATED: 'generated' as const,
    ERROR: 'error' as const,
  },

  // Render statuses
  RENDER: {
    PENDING: 'pending' as const,
    RENDERING: 'rendering' as const,
    RENDERED: 'rendered' as const,
    ERROR: 'error' as const,
  },

  // Workflow statuses
  WORKFLOW: {
    RUNNING: 'running' as const,
    COMPLETE: 'complete' as const,
    FAILED: 'failed' as const,
  },
} as const;

// ============================================================================
// Workflow Retry Policies
// ============================================================================

export const RETRY_POLICIES = {
  // Default retry policy for database operations
  DEFAULT: {
    limit: 3,
    delay: '2 seconds',
    backoff: 'constant',
  } as const,

  // Retry policy for AI/LLM calls
  AI_CALL: {
    limit: 3,
    delay: '5 seconds',
    backoff: 'exponential',
  } as const,

  // Retry policy for database operations (longer delay)
  DATABASE: {
    limit: 3,
    delay: '2 seconds',
    backoff: 'constant',
  } as const,

  // Retry policy for R2/storage operations
  STORAGE: {
    limit: 3,
    delay: '3 seconds',
    backoff: 'exponential',
  } as const,

  // Retry policy for browser scraping
  BROWSER_SCRAPING: {
    limit: 5,
    delay: '5 seconds',
    backoff: 'exponential',
  } as const,

  // Retry policy for cache operations
  CACHE: {
    limit: 3,
    delay: '1 second',
    backoff: 'constant',
  } as const,
} as const;

// ============================================================================
// Video Rendering Constants
// ============================================================================

export const VIDEO_RENDERING = {
  // Container timeout configuration
  INSTANCE_GET_TIMEOUT_MS: 120000 as number, // 2 minutes
  PORT_READY_TIMEOUT_MS: 180000 as number, // 3 minutes

  // FFmpeg execution timeout
  FFMPEG_TIMEOUT_MS: 300000 as number, // 5 minutes

  // Asset fetching timeout
  ASSET_FETCH_TIMEOUT_MS: 60000 as number, // 1 minute

  // Session retry configuration
  SESSION_RETRY_BASE_DELAY_MS: 2000 as number,

  // Default duration in seconds for slides (when metadata is missing)
  DEFAULT_SLIDE_DURATION_S: 10 as number,

  // Transition duration in seconds
  TRANSITION_DURATION_S: 1.0 as number,
} as const;

// ============================================================================
// Image Fetching Constants
// ============================================================================

export const IMAGE_FETCHING = {
  // Timeout for fetching images from URLs
  TIMEOUT_MS: 10000 as number, // 10 seconds
} as const;

// ============================================================================
// OAuth / Authentication Constants
// ============================================================================

export const OAUTH = {
  // OAuth state TTL in KV (5 minutes)
  STATE_TTL_MS: 300000 as number,

  // Token refresh threshold (5 minutes before expiry)
  REFRESH_THRESHOLD_MS: 300000 as number,
} as const;

// ============================================================================
// URL Patterns
// ============================================================================

export const URL_PATTERNS = {
  // Yahoo News pickup URL pattern
  YAHOO_PICKUP: /^https?:\/\/news\.yahoo\.co\.jp\/pickup\/\d+$/ as RegExp,

  // Yahoo News article URL pattern
  YAHOO_ARTICLE: /\/articles\/([a-z0-9]+)/i as RegExp,

  // Yahoo News base URL
  YAHOO_NEWS_BASE: 'https://news.yahoo.co.jp' as const,

  // Yahoo News top picks URL
  YAHOO_TOP_PICKS: 'https://news.yahoo.co.jp/topics/top-picks' as const,
} as const;

// ============================================================================
// Time Constants
// ============================================================================

export const TIME = {
  // One second in milliseconds
  SECOND_MS: 1000 as number,

  // One minute in milliseconds
  MINUTE_MS: 60000 as number,

  // One hour in milliseconds
  HOUR_MS: 3600000 as number,

  // One day in milliseconds
  DAY_MS: 86400000 as number,
} as const;

// ============================================================================
// Terminal Status States (for polling)
// ============================================================================

export const TERMINAL_STATES = {
  // Script generation terminal states
  SCRIPT: [STATUS.SCRIPT.GENERATED, STATUS.SCRIPT.ERROR] as const,

  // Asset generation terminal states
  ASSET: [STATUS.ASSET.GENERATED, STATUS.ASSET.ERROR] as const,

  // Render terminal states
  RENDER: [STATUS.RENDER.RENDERED, STATUS.RENDER.ERROR] as const,

  // Article terminal states
  ARTICLE: [STATUS.ARTICLE.SCRAPPED_V1, STATUS.ARTICLE.SCRAPPED_V2, STATUS.ARTICLE.NOT_AVAILABLE, STATUS.ARTICLE.ERROR] as const,

  // Workflow terminal states
  WORKFLOW: {
    COMPLETE: STATUS.WORKFLOW.COMPLETE,
    FAILED: STATUS.WORKFLOW.FAILED,
  } as const,
} as const;
