/**
 * Frontend Configuration Constants
 *
 * Single source of truth for frontend polling intervals and status values.
 * Centralized for maintainability and consistency.
 */

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

  // YouTube upload status polling
  YOUTUBE_UPLOAD_POLL_INTERVAL_MS: 5000,

  // Videos page workflow status polling
  VIDEOS_POLL_INTERVAL_MS: 3000,

  // Stale status threshold (10 minutes)
  STALE_STATUS_THRESHOLD_MS: 600000,
} as const;

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

  // YouTube upload statuses
  YOUTUBE_UPLOAD: {
    PENDING: 'pending',
    UPLOADING: 'uploading',
    PROCESSING: 'processing',
    UPLOADED: 'uploaded',
    BLOCKED: 'blocked',
    ERROR: 'error',
  },

  // Workflow statuses
  WORKFLOW: {
    RUNNING: 'running',
    COMPLETE: 'complete',
    FAILED: 'failed',
  },
} as const;

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

  // YouTube upload terminal states
  YOUTUBE_UPLOAD: [STATUS.YOUTUBE_UPLOAD.UPLOADED, STATUS.YOUTUBE_UPLOAD.BLOCKED, STATUS.YOUTUBE_UPLOAD.ERROR],

  // Article terminal states
  ARTICLE: [STATUS.ARTICLE.SCRAPPED_V1, STATUS.ARTICLE.SCRAPPED_V2, STATUS.ARTICLE.NOT_AVAILABLE, STATUS.ARTICLE.ERROR],

  // Workflow terminal states
  WORKFLOW: {
    COMPLETE: STATUS.WORKFLOW.COMPLETE,
    FAILED: STATUS.WORKFLOW.FAILED,
  },
};
