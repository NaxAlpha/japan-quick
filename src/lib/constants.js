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
    USER_AGENT: 'Mozilla/5.0 (compatible; JapanQuick/1.0)',
    // Timeout for page loads and scraping operations
    TIMEOUT_MS: 30000,
    // Timeout for news page scraping
    NEWS_TIMEOUT_MS: 20000,
    // Delay between article scrapes in serial operations
    DELAY_BETWEEN_ARTICLES_MS: 10000,
    // Maximum retry attempts for article scraping
    MAX_ARTICLE_RETRIES: 2,
    // Retry delay multiplier (5s, 10s)
    RETRY_DELAY_MS: 5000,
};
// ============================================================================
// Polling Intervals (Frontend)
// ============================================================================
export const POLLING = {
    // News workflow status polling
    NEWS_POLL_INTERVAL_MS: 2000,
    // Article status polling
    ARTICLE_POLL_INTERVAL_MS: 1000,
    // Article retry polling
    ARTICLE_RETRY_POLL_INTERVAL_MS: 2000,
    // Script generation status polling
    SCRIPT_POLL_INTERVAL_MS: 2500,
    // Asset generation status polling
    ASSET_POLL_INTERVAL_MS: 3000,
    // Video render status polling
    RENDER_POLL_INTERVAL_MS: 3000,
    // Videos page workflow status polling
    VIDEOS_POLL_INTERVAL_MS: 3000,
    // Stale status threshold (10 minutes)
    STALE_STATUS_THRESHOLD_MS: 600000,
};
// ============================================================================
// API Endpoints
// ============================================================================
export const API = {
    // News endpoints
    NEWS: {
        TRIGGER: '/api/news/trigger',
        TRIGGER_REFRESH: '/api/news/trigger-refresh',
        TRIGGER_RESCRAPE: '/api/news/trigger-rescrape',
        STATUS: (id) => `/api/news/status/${id}`,
        RESULT: (id) => `/api/news/result/${id}`,
        LATEST: '/api/news/latest',
        CANCEL: (id) => `/api/news/cancel/${id}`,
    },
    // Article endpoints
    ARTICLES: {
        BY_ID: (id) => `/api/articles/${id}`,
        VERSION: (id, version) => `/api/articles/${id}/version/${version}`,
        TRIGGER: (pickId) => `/api/articles/trigger/${pickId}`,
        STATUS: (workflowId) => `/api/articles/status/${workflowId}`,
    },
    // Video endpoints
    VIDEOS: {
        LIST: '/api/videos',
        BY_ID: (id) => `/api/videos/${id}`,
        TRIGGER: '/api/videos/trigger',
        STATUS: (workflowId) => `/api/videos/status/${workflowId}`,
        GENERATE_SCRIPT: (id) => `/api/videos/${id}/generate-script`,
        SCRIPT_STATUS: (id) => `/api/videos/${id}/script/status`,
        GENERATE_ASSETS: (id) => `/api/videos/${id}/generate-assets`,
        ASSETS_STATUS: (id) => `/api/videos/${id}/assets/status`,
        ASSET_BY_ID: (id, assetId) => `/api/videos/${id}/assets/${assetId}`,
        DELETE: (id) => `/api/videos/${id}`,
        RENDER: (id) => `/api/videos/${id}/render`,
        RENDER_STATUS: (id) => `/api/videos/${id}/render/status`,
    },
    // YouTube endpoints
    YOUTUBE: {
        STATUS: '/api/youtube/status',
        AUTH_URL: '/api/youtube/auth/url',
        OAUTH_CALLBACK: '/api/youtube/oauth/callback',
        REFRESH: '/api/youtube/refresh',
        DISCONNECT: '/api/youtube/auth',
    },
};
// ============================================================================
// Status Values
// ============================================================================
export const STATUS = {
    // Article statuses
    ARTICLE: {
        PENDING: 'pending',
        NOT_AVAILABLE: 'not_available',
        RETRY_1: 'retry_1',
        RETRY_2: 'retry_2',
        ERROR: 'error',
        SCRAPPED_V1: 'scraped_v1',
        SCRAPPED_V2: 'scraped_v2',
    },
    // Video statuses
    VIDEO: {
        TODO: 'todo',
        DOING: 'doing',
        DONE: 'done',
        ERROR: 'error',
    },
    // Script statuses
    SCRIPT: {
        PENDING: 'pending',
        GENERATING: 'generating',
        GENERATED: 'generated',
        ERROR: 'error',
    },
    // Asset statuses
    ASSET: {
        PENDING: 'pending',
        GENERATING: 'generating',
        GENERATED: 'generated',
        ERROR: 'error',
    },
    // Render statuses
    RENDER: {
        PENDING: 'pending',
        RENDERING: 'rendering',
        RENDERED: 'rendered',
        ERROR: 'error',
    },
    // Workflow statuses
    WORKFLOW: {
        RUNNING: 'running',
        COMPLETE: 'complete',
        FAILED: 'failed',
    },
};
// ============================================================================
// Workflow Retry Policies
// ============================================================================
export const RETRY_POLICIES = {
    // Default retry policy for database operations
    DEFAULT: {
        limit: 3,
        delay: '2 seconds',
        backoff: 'constant',
    },
    // Retry policy for AI/LLM calls
    AI_CALL: {
        limit: 3,
        delay: '5 seconds',
        backoff: 'exponential',
    },
    // Retry policy for database operations (longer delay)
    DATABASE: {
        limit: 3,
        delay: '2 seconds',
        backoff: 'constant',
    },
    // Retry policy for R2/storage operations
    STORAGE: {
        limit: 3,
        delay: '3 seconds',
        backoff: 'exponential',
    },
    // Retry policy for browser scraping
    BROWSER_SCRAPING: {
        limit: 5,
        delay: '5 seconds',
        backoff: 'exponential',
    },
    // Retry policy for cache operations
    CACHE: {
        limit: 3,
        delay: '1 second',
        backoff: 'constant',
    },
};
// ============================================================================
// Video Rendering Constants
// ============================================================================
export const VIDEO_RENDERING = {
    // Container timeout configuration
    INSTANCE_GET_TIMEOUT_MS: 120000, // 2 minutes
    PORT_READY_TIMEOUT_MS: 180000, // 3 minutes
    // FFmpeg execution timeout
    FFMPEG_TIMEOUT_MS: 300000, // 5 minutes
    // Asset fetching timeout
    ASSET_FETCH_TIMEOUT_MS: 60000, // 1 minute
    // Session retry configuration
    SESSION_RETRY_BASE_DELAY_MS: 2000,
    // Default duration in seconds for slides (when metadata is missing)
    DEFAULT_SLIDE_DURATION_S: 10,
    // Transition duration in seconds
    TRANSITION_DURATION_S: 1.0,
};
// ============================================================================
// Image Fetching Constants
// ============================================================================
export const IMAGE_FETCHING = {
    // Timeout for fetching images from URLs
    TIMEOUT_MS: 10000, // 10 seconds
};
// ============================================================================
// OAuth / Authentication Constants
// ============================================================================
export const OAUTH = {
    // OAuth state TTL in KV (5 minutes)
    STATE_TTL_MS: 300000,
    // Token refresh threshold (5 minutes before expiry)
    REFRESH_THRESHOLD_MS: 300000,
};
// ============================================================================
// URL Patterns
// ============================================================================
export const URL_PATTERNS = {
    // Yahoo News pickup URL pattern
    YAHOO_PICKUP: /^https?:\/\/news\.yahoo\.co\.jp\/pickup\/\d+$/,
    // Yahoo News article URL pattern
    YAHOO_ARTICLE: /\/articles\/([a-z0-9]+)/i,
    // Yahoo News base URL
    YAHOO_NEWS_BASE: 'https://news.yahoo.co.jp',
    // Yahoo News top picks URL
    YAHOO_TOP_PICKS: 'https://news.yahoo.co.jp/topics/top-picks',
};
// ============================================================================
// Time Constants
// ============================================================================
export const TIME = {
    // One second in milliseconds
    SECOND_MS: 1000,
    // One minute in milliseconds
    MINUTE_MS: 60000,
    // One hour in milliseconds
    HOUR_MS: 3600000,
    // One day in milliseconds
    DAY_MS: 86400000,
};
// ============================================================================
// Terminal Status States (for polling)
// ============================================================================
export const TERMINAL_STATES = {
    // Script generation terminal states
    SCRIPT: [STATUS.SCRIPT.GENERATED, STATUS.SCRIPT.ERROR],
    // Asset generation terminal states
    ASSET: [STATUS.ASSET.GENERATED, STATUS.ASSET.ERROR],
    // Render terminal states
    RENDER: [STATUS.RENDER.RENDERED, STATUS.RENDER.ERROR],
    // Article terminal states
    ARTICLE: [STATUS.ARTICLE.SCRAPPED_V1, STATUS.ARTICLE.SCRAPPED_V2, STATUS.ARTICLE.NOT_AVAILABLE, STATUS.ARTICLE.ERROR],
    // Workflow terminal states
    WORKFLOW: {
        COMPLETE: STATUS.WORKFLOW.COMPLETE,
        FAILED: STATUS.WORKFLOW.FAILED,
    },
};
//# sourceMappingURL=constants.js.map