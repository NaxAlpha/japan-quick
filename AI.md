# Japan Quick

## Summary

Japan Quick is an AI-based system to generate videos - both YouTube shorts and long-form video content. The application consists of:

- **Backend**: Hono-based API running on Cloudflare Workers for video processing and AI orchestration
- **Frontend**: Lit-based web component application with TypeScript for content management and control interface

## File Tree

```
japan-quick/
├── public/
│   └── index.html              # Main HTML entry point with app-root custom element
├── migrations/
│   ├── 002_articles.sql        # Database migration for articles tables
│   ├── 003_videos.sql          # Database migration for videos, models, cost_logs tables
│   └── 004_youtube_auth.sql    # Database migration for YouTube OAuth tokens
├── src/
│   ├── index.ts                # Cloudflare Workers backend with Hono + workflow exports
│   ├── middleware/
│   │   └── auth.ts             # Basic HTTP authentication middleware
│   ├── workflows/
│   │   ├── index.ts            # Export all workflow classes
│   │   ├── types.ts            # Workflow parameter and result types
│   │   ├── news-scraper.workflow.ts      # NewsScraperWorkflow (durable news scraping)
│   │   ├── scheduled-refresh.workflow.ts # ScheduledNewsRefreshWorkflow (cron-triggered)
│   │   ├── article-scraper.workflow.ts   # ArticleScraperWorkflow (article content scraping)
│   │   ├── article-rescrape.workflow.ts  # ArticleRescrapeWorkflow (cron-triggered rescrape)
│   │   └── video-selection.workflow.ts   # VideoSelectionWorkflow (AI video selection, cron-triggered)
│   ├── frontend/
│   │   ├── app.ts              # LitElement root component (AppRoot)
│   │   └── pages/
│   │       ├── news-page.ts    # News page component (workflow trigger/poll/result pattern)
│   │       ├── article-page.ts # Article detail page component
│   │       ├── videos-page.ts  # Videos page component (video selection management)
│   │       └── settings-page.ts # Settings page component (YouTube OAuth connection)
│   ├── services/
│   │   ├── news-scraper.ts           # Yahoo News Japan scraper (filters pickup URLs only, with thorough logging)
│   │   ├── article-scraper.ts        # Yahoo News article scraper (full content + comments)
│   │   ├── article-scraper-core.ts   # Core article scraping logic (serial processing)
│   │   ├── gemini.ts                 # Gemini AI service (article selection for videos)
│   │   └── youtube-auth.ts           # YouTube OAuth 2.0 service (token management, channel operations)
│   ├── types/
│   │   ├── news.ts             # News type definitions + Env type (single source of truth)
│   │   ├── article.ts          # Article type definitions
│   │   ├── video.ts            # Video type definitions (Video, Model, CostLog interfaces)
│   │   └── youtube.ts          # YouTube OAuth type definitions
│   ├── routes/
│   │   ├── news.ts             # API routes for news workflow management
│   │   ├── articles.ts         # API routes for article management
│   │   ├── videos.ts           # API routes for video workflow management
│   │   ├── youtube.ts          # API routes for YouTube OAuth (status, auth URL, callback, refresh, disconnect)
│   │   └── frontend.ts         # Frontend route handlers (/, /news, /article/:id, /videos, /settings)
│   ├── lib/
│   │   ├── logger.ts           # Structured logging utility with request ID tracking
│   │   └── html-template.ts    # HTML template utilities (with props support)
│   └── tests/
│       ├── unit/               # Unit tests for services, routes, lib
│       └── integration/        # Integration tests (e.g., news-e2e.test.ts)
├── tsconfig.json               # TypeScript config for backend (Cloudflare Workers)
├── tsconfig.frontend.json      # TypeScript config for frontend (browser)
├── vitest.config.ts            # Vitest config with Cloudflare Workers pool
├── wrangler.toml               # Cloudflare Workers configuration + auth credentials
└── package.json                # Dependencies and scripts
```

## Architecture

### Backend (Cloudflare Workers + Hono)

- Entry point: `src/index.ts`
- Framework: Hono.js
- Deployment: Cloudflare Workers via Wrangler
- Static assets: Served via Wrangler's `[assets]` configuration (wrangler.toml)
- Core Purpose: Orchestrates AI-based video generation workflow
- **Authentication**: Basic HTTP Auth protecting **API routes only** (frontend is public)
- Routes:
  - `GET /` - Home page (public, renders app-root component)
  - `GET /news` - News page (public, renders news-page component)
  - `GET /article/:id` - Article detail page (public, renders article-page component)
  - `GET /videos` - Videos page (public, renders videos-page component)
  - `GET /settings` - Settings page (public, renders settings-page component - YouTube OAuth)
  - `GET /api/status` - Service status endpoint (protected)
  - `GET /api/hello` - Health check/JSON API endpoint (protected)
  - **News Workflow Routes (protected):**
    - `POST /api/news/trigger` - Create new workflow instance (NewsScraperWorkflow)
    - `POST /api/news/trigger-refresh` - Manually trigger scheduled refresh workflow
    - `POST /api/news/trigger-rescrape` - Manually trigger article rescrape workflow
    - `GET /api/news/status/:id` - Get workflow status
    - `GET /api/news/result/:id` - Get completed workflow result
    - `GET /api/news/latest` - Get most recent D1 snapshot with article status
    - `POST /api/news/cancel/:id` - Terminate workflow
  - **Article API Routes (protected):**
    - `GET /api/articles/:id` - Get article by pick:xxx or article_id
    - `GET /api/articles/:id/version/:version` - Get specific version
    - `POST /api/articles/trigger/:pickId` - Manual trigger
    - `GET /api/articles/status/:workflowId` - Workflow status
  - **Video API Routes (protected):**
    - `GET /api/videos` - List videos with pagination (page query param, returns pagination metadata)
    - `GET /api/videos/:id` - Get single video with cost logs
    - `POST /api/videos/trigger` - Manual workflow trigger
    - `GET /api/videos/status/:workflowId` - Workflow status
    - `DELETE /api/videos/:id` - Delete video and its cost logs
  - **YouTube OAuth API Routes (protected):**
    - `GET /api/youtube/status` - Get current YouTube authentication status
    - `GET /api/youtube/auth/url` - Generate OAuth authorization URL
    - `GET /api/youtube/oauth/callback` - Handle OAuth callback from Google (redirects to /settings)
    - `POST /api/youtube/refresh` - Manually refresh access token
    - `DELETE /api/youtube/auth` - Deauthorize and clear tokens

### Frontend (Lit + TypeScript)

- Entry point: `public/index.html`
- Framework: Lit (Web Components)
- Components:
  - `<app-root>`: Home page with navigation and API test button
  - `<news-page>`: News scraping interface with article status badges (all article clicks navigate to article page)
  - `<article-page>`: Article detail view with version selector, workflow trigger for unscraped articles
  - `<videos-page>`: Video selection management interface with workflow trigger
- Build output: `public/frontend/` directory (from TypeScript compilation)
- Styling: Scoped CSS within Lit components
- Purpose: Provides interface for content generation, preview, and management

### Cloudflare Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `BROWSER` | Browser Binding | Puppeteer-based scraping in production |
| `NEWS_CACHE` | KV Namespace | Cache scraped news for 35 minutes; OAuth state storage (5min TTL) |
| `DB` | D1 Database | Store news snapshots, articles, videos, and YouTube auth tokens |
| `NEWS_SCRAPER_WORKFLOW` | Workflow | Durable news scraping workflow |
| `SCHEDULED_REFRESH_WORKFLOW` | Workflow | Cron-triggered background refresh workflow |
| `ARTICLE_SCRAPER_WORKFLOW` | Workflow | Article content scraping workflow |
| `ARTICLE_RESCRAPE_WORKFLOW` | Workflow | Cron-triggered article rescrape workflow |
| `VIDEO_SELECTION_WORKFLOW` | Workflow | Video selection workflow |
| `ADMIN_USERNAME` | Var | Basic auth username |
| `ADMIN_PASSWORD` | Var | Basic auth password |
| `GOOGLE_API_KEY` | Secret | Gemini API key (stored in Cloudflare Secrets) |
| `YOUTUBE_CLIENT_ID` | Secret | YouTube OAuth client ID |
| `YOUTUBE_CLIENT_SECRET` | Secret | YouTube OAuth client secret |
| `YOUTUBE_REDIRECT_URI` | Secret | YouTube OAuth redirect URI |

### Cloudflare Workflows

The application uses **Cloudflare Workflows** for durable, retriable execution of scraping operations.

**NewsScraperWorkflow**:

| Step | Description | Retry Policy |
|------|-------------|--------------|
| `check-cache` | Check KV for cached data | 3 retries, 1s delay |
| `scrape-news` | Browser scraping | 5 retries, 5s exponential backoff |
| `save-to-cache` | Store in KV (35min TTL) | 3 retries, 1s delay |
| `save-to-database` | Persist snapshot to D1 | 3 retries, 2s delay |

**ScheduledNewsRefreshWorkflow**:

Cron-triggered background refresh (hourly):
- `scrape-fresh-news` - Always scrape fresh (no cache check)
- `update-cache` - Update KV cache
- `save-snapshot` - Save to D1
- `find-new-articles` - Identify new pickup IDs not yet in database
- `scrape-article-${pickId}` - Serial article scraping using scrapeArticleCore() with 10-second delays between articles
- Uses src/services/article-scraper-core.ts for fault-tolerant scraping (comments failures don't block article saves)

**ArticleScraperWorkflow**:

| Step | Description | Retry Policy |
|------|-------------|--------------|
| `check-existing` | Check if article exists | - |
| `scrape-article` | Scrape pickup → article → comments | 3 attempts with retry status |
| `save-article` | Insert/update article record | 3 retries, 2s delay |
| `save-version` | Save content to article_versions | 3 retries, 2s delay |
| `save-comments` | Save comments | 3 retries, 2s delay |
| `update-status` | Update status, schedule rescrape | - |

**Article Status Progression**: `pending` → `retry_1` → `retry_2` → `error` → `scraped_v1` → `scraped_v2`

**ArticleRescrapeWorkflow**:

Cron-triggered article rescraping (hourly):
- `find-due-articles` - Query articles with `scraped_v1` status and scheduled_rescrape_at <= now
- `rescrape-article-${pickId}` - Serial rescraping using scrapeArticleCore() with 10-second delays
- Updates status to `scraped_v2`, sets second_scraped_at, clears scheduled_rescrape_at
- Tracks both scrapedPickIds and failedPickIds for reporting
- Uses src/services/article-scraper-core.ts with isRescrape=true

**VideoSelectionWorkflow**:

| Step | Description | Retry Policy |
|------|-------------|--------------|
| `fetch-eligible-articles` | Query articles with `scraped_v2` status from last 24 hours, excluding articles already used in videos | 3 retries, 2s constant delay |
| `create-video-entry` | Create video record with `doing` status | 3 retries, 2s constant delay |
| `call-gemini-ai` | Use Gemini 3 Flash to select articles | 3 retries, 5s exponential backoff |
| `log-cost` | Track input/output tokens and calculate cost | 3 retries, 2s constant delay |
| `update-video-entry` | Update with AI results, set status to `todo` | 3 retries, 2s constant delay |

**Error Handling**: Workflow sets video status to `error` on failure instead of leaving it stuck in `doing`.

**Note**: Workflows require remote deployment to test - use `wrangler dev --remote` or `wrangler deploy`. Cron triggers only work in production. The cron runs hourly (0 * * * *), triggering ScheduledNewsRefreshWorkflow, ArticleRescrapeWorkflow, and VideoSelectionWorkflow (during JST business hours only).

### Type System

The `Env` type (single source of truth in `src/types/news.ts`) defines all Cloudflare Workers bindings:

```typescript
export type Env = {
  Bindings: {
    ADMIN_USERNAME: string;
    ADMIN_PASSWORD: string;
    GOOGLE_API_KEY: string;
    BROWSER: BrowserBinding | null;  // Can be null in local dev
    NEWS_CACHE: KVNamespace;
    DB: D1Database;
    NEWS_SCRAPER_WORKFLOW: Workflow;
    SCHEDULED_REFRESH_WORKFLOW: Workflow;
    ARTICLE_SCRAPER_WORKFLOW: Workflow;
    ARTICLE_RESCRAPE_WORKFLOW: Workflow;
    VIDEO_SELECTION_WORKFLOW: Workflow;
  }
};
```

## Development Guide

### Commands

```bash
# Install dependencies
bun install

# Build frontend TypeScript to JavaScript
bun run build:frontend

# Start local development server (Wrangler)
bun run dev

# Start remote development server (for testing workflows)
wrangler dev --remote

# Run tests
bun run test

# Run tests with UI
bun run test:ui

# Run tests with coverage
bun run test:coverage

# Deploy to Cloudflare Workers (includes frontend build)
bun run deploy
```

### Development Patterns

- **Backend**: RESTful API with Hono, following standard Workers patterns for AI orchestration
- **Frontend**: Web Components with Lit, using scoped CSS and declarative rendering for content management UI
- **Type Safety**: Full TypeScript coverage with strict mode enabled
- **Module System**: ES modules throughout (type: "module" in package.json)
- **Testing**: Vitest with Cloudflare Workers pool for unit and integration tests

### Logging

The application uses a structured logging utility (`src/lib/logger.ts`) for consistent, debuggable logs.

**Log format:** `[reqId] [timestamp] [level] [component] message | key=value`

**Usage:**
```typescript
import { log, generateRequestId } from '../lib/logger.js';

// Routes and workflows - generate reqId once, pass through
const reqId = generateRequestId();
log.newsRoutes.info(reqId, 'Request received', { method: 'POST', path: '/trigger' });

// Services - accept reqId as first parameter
async selectArticles(reqId: string, articles: Article[]) {
  log.gemini.info(reqId, 'Article selection started', { articleCount: articles.length });
}

// Middleware and utility - no reqId needed (auto-generated)
log.auth.info('Auth attempt', { path: '/api/hello', hasUsername: 'present' });
```

**Guidelines:**
- Generate `reqId` once per request/workflow, pass to all service calls
- Always include relevant IDs: `pickId`, `videoId`, `articleId`, `workflowId`
- Include `durationMs` for operations that take time
- Use INFO for key operations, ERROR with error object for failures
- Request IDs enable correlation of logs from parallel operations

### Testing & Verification

- **Local development**: Workflows are NOT supported in `wrangler dev` (local mode)
- **Remote development**: Use `wrangler dev --remote` to test workflows
- **Production**: Deploy with `wrangler deploy` for full workflow functionality
- **Cron triggers**: Only work in production, not in dev mode

## Cloudflare Account Information

- **Account ID**: `ccccd0d9d16426ee80bf27b0c0b8a9cb`
- **Production URL**: `https://japan-quick.nax.workers.dev`
- **Worker Subdomain**: `nax.workers.dev`

### Workflow Scheduling

- **VideoSelectionWorkflow**: Runs hourly only during JST business hours (8am-8pm JST, which is UTC 23:00, 00:00-11:00)

## Authentication

The application uses **Basic HTTP Authentication** to protect API routes only. Frontend pages are publicly accessible.

### Credentials

Credentials are stored in `wrangler.toml` under `[vars]`:
```toml
[vars]
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "GvkP525fTX0ocMTw8XtAqM9ECvNIx50v"
```

**Note**: `GOOGLE_API_KEY` is stored as a Cloudflare Secret (not in `wrangler.toml`) for security.

To change the password, generate a new one:
```bash
openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
```

### How It Works

- **Middleware**: `src/middleware/auth.ts` implements Basic HTTP Auth validation
- **API routes protected**: `app.use('/api/*', basicAuth())` in `src/index.ts`
- **Frontend routes public**: No auth required for `/` and `/news`
- **Browser-native**: Login prompt shown by browser automatically
- **Stateless**: No sessions or tokens, credentials validated on each request

### Testing Auth

```bash
# Frontend (no auth required)
curl -i https://your-worker.workers.dev/

# API without auth (should return 401)
curl -i https://your-worker.workers.dev/api/hello

# API with valid auth
curl -u admin:password https://your-worker.workers.dev/api/hello
```

**Note**: Credentials in `wrangler.toml` are visible to anyone with repo access.

## Secrets Management

### Google API Key (Gemini)

The `GOOGLE_API_KEY` is stored in **Cloudflare Secrets** (not in `wrangler.toml`) for security:

```bash
# Add/update secret (using key from ~/.zshrc)
echo $GOOGLE_API_KEY | wrangler secret put GOOGLE_API_KEY

# List all secrets
wrangler secret list

# Delete a secret
wrangler secret delete GOOGLE_API_KEY
```

**Important**:
- Never commit API keys to `wrangler.toml` or version control
- Store sensitive keys in Cloudflare Secrets
- Keep local copies in `~/.zshrc` or secure environment
- Secrets are accessible in code via `env.GOOGLE_API_KEY` (same as vars)

## Data Schemas

### KV Cache (NEWS_CACHE)

- **Key**: `yahoo-japan-top-picks`
- **TTL**: 2100 seconds (35 minutes)
- **Purpose**: Reduce scraping frequency and improve response times
- **Note**: TTL is 35 minutes to ensure cache stays alive between 30-minute scheduled runs

### D1 Database (DB)

```sql
CREATE TABLE news_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  captured_at TEXT NOT NULL,
  snapshot_name TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pick_id TEXT NOT NULL UNIQUE,
  article_id TEXT,
  article_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  title TEXT,
  source TEXT,
  thumbnail_url TEXT,
  published_at TEXT,
  modified_at TEXT,
  detected_at TEXT NOT NULL,
  first_scraped_at TEXT,
  second_scraped_at TEXT,
  scheduled_rescrape_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE article_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_text TEXT,
  page_count INTEGER DEFAULT 1,
  images TEXT,
  scraped_at TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES articles(id),
  UNIQUE(article_id, version)
);

CREATE TABLE article_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  comment_id TEXT,
  author TEXT,
  content TEXT NOT NULL,
  posted_at TEXT,
  likes INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  scraped_at TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES articles(id)
);

CREATE TABLE models (
  id TEXT PRIMARY KEY,                    -- e.g., "gemini-3-flash-preview"
  name TEXT NOT NULL,                     -- e.g., "Gemini 3 Flash"
  description TEXT,                       -- Model description
  input_cost_per_million REAL NOT NULL,   -- Cost per 1M input tokens (e.g., 0.50)
  output_cost_per_million REAL NOT NULL,  -- Cost per 1M output tokens (e.g., 3.00)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notes TEXT,                    -- Newline-joined selection rationale strings
  short_title TEXT,              -- English title for video
  articles TEXT,                 -- JSON array of pick_id values
  video_type TEXT NOT NULL,      -- "short" | "long"
  selection_status TEXT NOT NULL DEFAULT 'todo',  -- "todo" | "doing" | "done"
  total_cost REAL DEFAULT 0,     -- Sum of all cost_logs for this video
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cost_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  log_type TEXT NOT NULL,        -- e.g., "video-selection", "script-generation"
  model_id TEXT NOT NULL,        -- FK to models.id
  attempt_id INTEGER DEFAULT 1,  -- Attempt number for retries
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost REAL NOT NULL,            -- Calculated cost for this operation
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (video_id) REFERENCES videos(id),
  FOREIGN KEY (model_id) REFERENCES models(id)
);
```

- **news_snapshots.data**: JSON string containing the full YahooNewsResponse
- **articles.status**: pending | not_available | retry_1 | retry_2 | error | scraped_v1 | scraped_v2
- **article_versions.version**: 1 (first scrape) or 2 (rescrape after 1 hour)
- **models.id**: Model identifier (e.g., "gemini-3-flash-preview")
- **videos.video_type**: short (60-120s, 1080x1920) | long (4-6min, 1920x1080)
- **videos.selection_status**: todo | doing | done | error
- **videos.articles**: JSON array of pick_id values selected by AI
- **cost_logs.log_type**: Operation type (e.g., "video-selection", "script-generation")

## Yahoo News Japan Scraper

The application includes a Yahoo News Japan scraper that fetches top news picks.

### URL Filtering

The scraper filters to only include "pickup" URLs:
- **Included**: `https://news.yahoo.co.jp/pickup/XXXXXXX` (7-digit numeric IDs)
- **Excluded**: Topic pages like `https://news.yahoo.co.jp/topics/science`

Filtering regex: `/^https?:\/\/news\.yahoo\.co\.jp\/pickup\/\d+$/`

### Scraping Strategy

- **Browser Mode (Production)**: Uses Cloudflare Browser Binding with Puppeteer
- **No HTTP Fallback**: All scraping requires browser binding for reliability
- **Two-Pass Article Scraping**: First scrape (v1) immediately, rescrape (v2) after 1 hour

### Content Extraction

Article scraper uses semantic HTML selectors:
- **Title**: `article h1` (primary), any `h1` (fallback)
- **Content**: `.article_body` div (primary), `article` tag with `p, h2, h3, h4` elements (fallback)
- **Images**: Filtered to exclude icons and SVGs by URL patterns
- **Pagination**: Dual strategy - pagination links and pagination containers

**Best Practice**: Always use semantic HTML selectors (`article`, `h1`, `p`) or stable class names (`.article_body`) instead of generated/hashed class names.

## Gemini AI Integration

The application uses Google's Gemini AI to intelligently select articles for video generation.

### Model Configuration

- **Model**: `gemini-3-flash-preview` (Gemini 3 Flash)
- **Pricing**:
  - Input: $0.50 per 1M tokens
  - Output: $3.00 per 1M tokens
- **Purpose**: Analyze recently scraped articles and select the most important ones for video generation
- **Package**: `@google/genai` (Google's official Gemini API client)

### Selection Criteria

The AI evaluates articles based on five criteria:

1. **IMPORTANCE**: Impact on society, public interest, significance
2. **TIMELINESS**: Breaking news, trending topics, time-sensitive updates
3. **CLARITY**: Story is clear and can be explained effectively
4. **VISUAL POTENTIAL**: Story can be illustrated with graphics/footage
5. **ENGAGEMENT**: Likely to capture viewer attention

### AI Input Format

Articles are formatted with 4-digit indices for efficient reference:

```json
[
  {
    "index": "1234",
    "title": "Article title",
    "dateTime": "2024-01-01 12:00",
    "source": "News Source"
  }
]
```

**Index Mapping**: The service creates a mapping between 4-digit indices and pick_id values. Indices are extracted from the first 4 characters of pick_id, with collision handling using last 4 characters or incremental suffixes.

### AI Output Format

```json
{
  "notes": ["reason 1", "reason 2", "reason 3"],
  "short_title": "English title for the video (max 50 chars)",
  "articles": ["1234", "5678"],
  "video_type": "short" | "long"
}
```

- **notes**: Array of 2-5 clear, concise reasons for selection
- **short_title**: English title under 50 characters
- **articles**: Array of 4-digit indices selected by AI (mapped back to pick_ids)
- **video_type**:
  - `short` (60-120s, 1080x1920 vertical): Breaking news, urgent updates, trending topics
  - `long` (4-6 min, 1920x1080 horizontal): In-depth analysis, informative content, complex stories

**The AI MUST always select at least one article**: The prompt requires the AI to select at least one article, ensuring every workflow run produces a video selection.

**Prompt Configuration**:
- Includes examples for both short and long video types
- Content preferences: useful, helpful, educational
- Exclusions: celebrity gossip, death-related content, personal life stories

### Cost Tracking

All AI operations are tracked in the `cost_logs` table:
- Input/output token counts are recorded
- Cost is calculated based on model pricing
- Total cost per video is aggregated from all related operations
- Costs are displayed in the videos UI ($0.0000 format)

## YouTube OAuth 2.0 Integration

### Overview

The application integrates with YouTube OAuth 2.0 to enable video uploads to YouTube channels. Users can connect their YouTube channel through the settings page at `/settings`.

### OAuth Scopes

The integration requests the following YouTube scopes:
- `https://www.googleapis.com/auth/youtube.upload` - Upload videos to channel
- `https://www.googleapis.com/auth/youtube` - Manage YouTube account
- `https://www.googleapis.com/auth/yt-analytics.readonly` - View channel analytics

### OAuth Flow

1. User clicks "Connect YouTube Channel" on `/settings`
2. Frontend calls `GET /api/youtube/auth/url` to get OAuth URL and state
3. User is redirected to Google's OAuth consent screen
4. After approval, Google redirects to `/api/youtube/oauth/callback`
5. Backend exchanges authorization code for access and refresh tokens
6. Backend fetches channel info and stores in `youtube_auth` table
7. User is redirected back to `/settings?success=connected`

### Token Management

- **Access Token**: Stored in `youtube_auth.access_token`, expires after 1 hour
- **Refresh Token**: Stored in `youtube_auth.refresh_token`, used to get new access tokens
- **Auto-Refresh**: When token expires in < 5 minutes, auto-refresh on next API call
- **Manual Refresh**: User can click "Refresh Token" button in settings

### Database Schema

```sql
CREATE TABLE youtube_auth (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL UNIQUE,
  channel_title TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  scopes TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### State Management (CSRF Protection)

OAuth state is stored in `NEWS_CACHE` KV namespace with 5-minute TTL:
- Key: `oauth_state:{random_state}`
- Value: `{"createdAt": timestamp}`
- Deleted after verification (one-time use)

### Settings Page (`/settings`)

The settings page displays:
- Connection status badge (Connected / Not Connected)
- Channel name and ID (when connected)
- Token expiry time with color-coded warnings
- Granted permissions as formatted badges
- Connect / Disconnect / Refresh Token buttons

## Platform Notes

### Cloudflare Workers Specifics

- **Static file serving**: Handled by Wrangler's `[assets]` configuration in wrangler.toml, NOT by Hono middleware
- **Do NOT use `serveStatic`** from `hono/cloudflare-workers` - causes `__STATIC_CONTENT is not defined` errors in local dev

### Browser Binding Best Practices

**Required for Puppeteer in Cloudflare Workers**:
1. Install `@cloudflare/puppeteer` package
2. Add `compatibility_flags = ["nodejs_compat"]` to wrangler.toml
3. Use `puppeteer.launch(browserBinding)` pattern - never call methods directly on the binding

**Session Management**:
```typescript
const browser = await puppeteer.launch(browserBinding);
const page = await browser.newPage();
// ... perform scraping operations ...
await page.close();
await browser.disconnect();  // NOT browser.close() - use disconnect() to allow session reuse
```

**Why disconnect() instead of close()?**
- `browser.disconnect()` preserves the browser session for reuse
- Prevents "Websocket error: SessionID: xxx" errors
- Follows Cloudflare's recommended pattern for session management
- Avoids "waitUntil() tasks did not complete" warnings

### Browser Binding in Workflows

Cloudflare Browser Rendering DOES work in Workflows when using @cloudflare/puppeteer:
1. Add `BROWSER` to the `WorkflowEnv` interface
2. Use `puppeteer.launch(this.env.BROWSER)` in workflow steps
3. Always use `browser.disconnect()` for cleanup

### Build Process

1. **Frontend Build**: Run `bun run build:frontend` to compile TypeScript from `src/frontend/` to `public/frontend/`
2. **Development**: Use `bun run dev` to run Wrangler dev server with hot reloading
3. **Production**: Deploy with `bun run deploy` to push to Cloudflare Workers

### Important Notes

- The frontend is built automatically during deployment via `bun run deploy`
- For local development only, manually build with `bun run build:frontend`
- Lit uses decorators (experimentalDecorators: true in tsconfig)
- The `useDefineForClassFields: false` setting is required for Lit to work correctly with TypeScript
- The `Env` type is defined in `src/types/news.ts` as the single source of truth
- The `BROWSER` binding can be `null` in local development (no browser binding available)
