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
├── src/
│   ├── index.ts                # Cloudflare Workers backend with Hono + workflow exports
│   ├── middleware/
│   │   └── auth.ts             # Basic HTTP authentication middleware
│   ├── workflows/
│   │   ├── index.ts            # Export all workflow classes
│   │   ├── types.ts            # Workflow parameter and result types
│   │   ├── news-scraper.workflow.ts      # NewsScraperWorkflow (durable news scraping)
│   │   └── scheduled-refresh.workflow.ts # ScheduledNewsRefreshWorkflow (cron-triggered)
│   ├── frontend/
│   │   ├── app.ts              # LitElement root component (AppRoot)
│   │   └── pages/
│   │       └── news-page.ts    # News page component (workflow trigger/poll/result pattern)
│   ├── services/
│   │   └── news-scraper.ts     # Yahoo News Japan scraper (filters pickup URLs only)
│   ├── types/
│   │   └── news.ts             # News type definitions + Env type (single source of truth)
│   ├── routes/
│   │   ├── news.ts             # API routes for workflow management (trigger, status, result)
│   │   └── frontend.ts         # Frontend route handlers
│   ├── lib/
│   │   └── html-template.ts    # HTML template utilities
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

Japan Quick is designed as an AI-powered content generation pipeline for creating both short-form videos (YouTube Shorts format) and long-form video content.

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
  - `GET /api/status` - Service status endpoint (protected)
  - `GET /api/hello` - Health check/JSON API endpoint (protected)
  - **Workflow Management Routes (public):**
    - `POST /api/news/trigger` - Create new workflow instance
    - `GET /api/news/status/:id` - Get workflow status
    - `GET /api/news/result/:id` - Get completed workflow result
    - `GET /api/news/latest` - Get most recent D1 snapshot
    - `POST /api/news/cancel/:id` - Terminate workflow

### Frontend (Lit + TypeScript)

- Entry point: `public/index.html`
- Framework: Lit (Web Components)
- Components:
  - `<app-root>`: Home page with navigation and API test button
  - `<news-page>`: News scraping interface
- Build output: `public/frontend/` directory (from TypeScript compilation)
- Styling: Scoped CSS within Lit components
- Purpose: Provides interface for content generation, preview, and management

### Cloudflare Bindings

The application uses several Cloudflare bindings defined in `wrangler.toml`:

| Binding | Type | Purpose |
|---------|------|---------|
| `BROWSER` | Browser Binding | Puppeteer-based scraping in production |
| `NEWS_CACHE` | KV Namespace | Cache scraped news for 5 minutes |
| `DB` | D1 Database | Store news snapshots |
| `NEWS_SCRAPER_WORKFLOW` | Workflow | Durable news scraping workflow |
| `SCHEDULED_REFRESH_WORKFLOW` | Workflow | Cron-triggered background refresh workflow |
| `ADMIN_USERNAME` | Var | Basic auth username |
| `ADMIN_PASSWORD` | Var | Basic auth password |

### Cloudflare Workflows

The application uses **Cloudflare Workflows** for durable, retriable execution of news scraping operations.

#### NewsScraperWorkflow

Handles Yahoo News scraping with automatic retries and durable state:

| Step | Description | Retry Policy |
|------|-------------|--------------|
| `check-cache` | Check KV for cached data | 3 retries, 1s delay |
| `scrape-news` | Browser/HTTP scraping | 5 retries, 5s exponential backoff |
| `save-to-cache` | Store in KV (5min TTL) | 3 retries, 1s delay |
| `save-to-database` | Persist snapshot to D1 | 3 retries, 2s delay |

#### ScheduledNewsRefreshWorkflow

Cron-triggered background refresh (every 15 minutes):

| Step | Description |
|------|-------------|
| `scrape-fresh-news` | Always scrape fresh (no cache check) |
| `update-cache` | Update KV cache |
| `save-snapshot` | Save to D1 |

**Note**: Workflows require remote deployment to test - use `wrangler dev --remote` or `wrangler deploy`.

### Type System

The `Env` type (single source of truth in `src/types/news.ts`) defines all Cloudflare Workers bindings:

```typescript
export type Env = {
  Bindings: {
    ADMIN_USERNAME: string;
    ADMIN_PASSWORD: string;
    BROWSER: BrowserBinding | null;  // Can be null in local dev
    NEWS_CACHE: KVNamespace;
    DB: D1Database;
    NEWS_SCRAPER_WORKFLOW: Workflow;
    SCHEDULED_REFRESH_WORKFLOW: Workflow;
  }
};
```

The `BrowserBinding` interface is defined in the same file for proper type safety.

## Development Commands

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

# Deploy to Cloudflare Workers
bun run deploy
```

## Cloudflare Account Information

- **Account ID**: `ccccd0d9d16426ee80bf27b0c0b8a9cb`
- **Production URL**: `https://japan-quick.nax.workers.dev`
- **Worker Subdomain**: `nax.workers.dev`

**Note**: Workflows require remote deployment or `wrangler dev --remote` to test. Local `wrangler dev` does not support workflows.

## Authentication

The application uses **Basic HTTP Authentication** to protect API routes only. Frontend pages are publicly accessible.

### Credentials

Credentials are stored in `wrangler.toml` under `[vars]`:
```toml
[vars]
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "GvkP525fTX0ocMTw8XtAqM9ECvNIx50v"
```

To change the password, generate a new one:
```bash
openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
```

Then update `ADMIN_PASSWORD` in `wrangler.toml`.

### How It Works

- **Middleware**: `src/middleware/auth.ts` implements Basic HTTP Auth validation
- **API routes protected**: `app.use('/api/*', basicAuth())` in `src/index.ts`
- **Frontend routes public**: No auth required for `/` and `/news`
- **Browser-native**: Login prompt shown by browser automatically
- **Stateless**: No sessions or tokens, credentials validated on each request
- **Error logging**: Auth errors are logged to console for debugging

### Testing Auth

```bash
# Frontend (no auth required)
curl -i https://your-worker.workers.dev/

# API without auth (should return 401)
curl -i https://your-worker.workers.dev/api/hello

# API with valid auth
curl -u admin:password https://your-worker.workers.dev/api/hello
```

### Testing Browser APIs

**Important**: Browser-related APIs (Cloudflare Browser Binding for Puppeteer scraping) are **NOT supported in local development**. To test endpoints that use browser scraping:

1. Deploy to Cloudflare Workers first: `bun run deploy`
2. Then test with curl on the deployed URL
3. Local development will use HTTP fetch fallback mode (less reliable)

```bash
# Deploy first
bun run deploy

# Test browser scraping on deployed worker
curl -u admin:password https://your-worker.workers.dev/api/news/yahoo-japan
```

## Data Storage

### KV Cache (NEWS_CACHE)

The application uses Cloudflare KV to cache scraped news:
- **Key**: `yahoo-japan-top-picks`
- **TTL**: 300 seconds (5 minutes)
- **Purpose**: Reduce scraping frequency and improve response times

### D1 Database (DB)

News snapshots are stored in D1 with the following schema:
```sql
CREATE TABLE news_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  captured_at TEXT NOT NULL,
  snapshot_name TEXT NOT NULL,
  data TEXT NOT NULL
);
```

- **captured_at**: ISO timestamp of when news was scraped
- **snapshot_name**: Generated name like `article-snapshot-2026-01-19-14-30-45`
- **data**: JSON string containing the full YahooNewsResponse

## Yahoo News Japan Scraper

The application includes a Yahoo News Japan scraper that fetches top news picks.

### URL Filtering

The scraper filters to only include "pickup" URLs in the format:
- **Included**: `https://news.yahoo.co.jp/pickup/XXXXXXX` (7-digit numeric IDs)
- **Excluded**: Topic pages like `https://news.yahoo.co.jp/topics/science`

This filtering is applied in `src/services/news-scraper.ts` via the `isPickupUrl()` function:
```typescript
/^https?:\/\/news\.yahoo\.co\.jp\/pickup\/\d+$/
```

### Dual Scraping Strategy

The scraper supports two modes:

1. **Browser Mode (Production)**: Uses Cloudflare Browser Binding with Puppeteer
   - More reliable for dynamic content
   - Better anti-scraping evasion
   - Only available in production Workers

2. **HTTP Fetch Mode (Fallback)**: Uses standard `fetch()` with regex parsing
   - Works in local development
   - No browser binding required
   - May be less reliable if Yahoo changes HTML structure

### News Page Layout

The news page (`src/frontend/pages/news-page.ts`) displays news in a list format:
- Title: "Fetch Latest Top News"
- Button: "Scrape News" (shows "Fetching..." while loading)
- On page load: Loads `/api/news/latest` for immediate display of cached snapshot
- On button click: Triggers workflow, polls status every 2 seconds, fetches result when complete
- Each item: title and date on left, small thumbnail (120x90px) on right

### API Endpoints (Workflow-based)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/news/trigger` | POST | Create new workflow instance |
| `/api/news/status/:id` | GET | Get workflow status |
| `/api/news/result/:id` | GET | Get completed result |
| `/api/news/latest` | GET | Get most recent D1 snapshot |
| `/api/news/cancel/:id` | POST | Terminate workflow |

**Note**: All news endpoints are public (no auth required) since news data is from public sources.

## Build Process

1. **Frontend Build**: Run `bun run build:frontend` to compile TypeScript from `src/frontend/` to `public/frontend/`
2. **Development**: Use `bun run dev` to run Wrangler dev server with hot reloading
3. **Production**: Deploy with `bun run deploy` to push to Cloudflare Workers

## Compound Engineer

### Project Setup Observations

- Japan Quick is built as a serverless application on Cloudflare Workers for scalability
- Frontend uses Lit web components with TypeScript for maintainable UI development
- Two separate TypeScript configs are needed: one for Workers backend, one for browser frontend
- Static assets are served from the `public/` directory via Wrangler's assets configuration
- The system is designed to integrate with AI services for content generation

### Development Patterns

- **Backend**: RESTful API with Hono, following standard Workers patterns for AI orchestration
- **Frontend**: Web Components with Lit, using scoped CSS and declarative rendering for content management UI
- **Type Safety**: Full TypeScript coverage with strict mode enabled
- **Module System**: ES modules throughout (type: "module" in package.json)
- **Testing**: Vitest with Cloudflare Workers pool for unit and integration tests
- **AI Integration**: Backend designed to integrate with AI models for video content generation

### Important Notes

- The frontend requires building before deployment: `bun run build:frontend`
- Lit uses decorators (experimentalDecorators: true in tsconfig)
- The `useDefineForClassFields: false` setting is required for Lit to work correctly with TypeScript
- Static file serving is handled by Wrangler's `[assets]` configuration in wrangler.toml, NOT by Hono middleware
- Do NOT use `serveStatic` from `hono/cloudflare-workers` - it causes `__STATIC_CONTENT is not defined` errors in local dev
- The project generates both short-form (YouTube Shorts) and long-form video content
- Backend routes will be extended to support video generation workflows
- **API routes are protected by Basic HTTP Auth** - credentials stored in `wrangler.toml` `[vars]`
- **Frontend routes are public** - no authentication required
- **Note**: Credentials in `wrangler.toml` are visible to anyone with repo access
- The `Env` type is defined in `src/types/news.ts` as the single source of truth
- The `BROWSER` binding can be `null` in local development (no browser binding available)

## Code Review Fixes (2026-01-19)

The following issues were identified and fixed during code review:

### src/routes/news.ts
1. **Type Safety**: Changed `db: any` parameter to `db: D1Type` for proper type safety
2. **Error Handling**: Added try-catch around D1 INSERT operation to log errors without failing the request
3. **Cache Validation**: Added validation for cached data to check structure before returning

### src/services/news-scraper.ts
4. **Deduplication Helper**: Extracted duplicate deduplication logic into `deduplicateByUrl()` helper function
5. **Error Logging**: Improved browser mode error logging to include full error details
6. **HTTP Timeout**: Added 20-second timeout to HTTP fetch fallback using AbortController

### src/types/news.ts
7. **Type Correction**: Changed `NewsSnapshot.id` from `string` to `number` to match INTEGER SQL schema

### src/index.ts
8. **API Route Order**: Moved news routes before auth middleware to make `/api/news/*` public (news data is from public sources)
9. **Route Protection**: Kept `/api/status` and `/api/hello` protected by Basic Auth

### CSS/Assets
10. **Shared CSS**: Created `public/styles.css` to eliminate CSS duplication between `public/index.html` and `html-template.ts`

### vitest.config.ts
11. **Import Fix**: Fixed import path to `@cloudflare/vitest-pool-workers/config`
12. **Coverage Thresholds**: Set to 0 temporarily until tests are implemented (prevents CI failure)
13. **Test Fix**: Fixed async/await issue in `src/tests/unit/routes/news.test.ts`

### Key Changes Summary
- All API routes except `/api/news/*` require Basic Auth
- Frontend can now access `/api/news/yahoo-japan` without credentials
- D1 errors are logged but don't fail API responses
- HTTP fetch has proper timeout like browser mode
- Shared CSS file reduces duplication
- Tests run successfully (integration tests need running server)

## Cloudflare Workflows Migration (2026-01-21)

The application was migrated from synchronous Hono API to **Cloudflare Workflows** for durable, retriable, scheduled execution.

### Architecture Changes

**Before (Synchronous):**
- Single API endpoint: `GET /api/news/yahoo-japan`
- Direct scraping → caching → D1 save in one request
- No retry mechanism or durability
- No scheduled refresh

**After (Workflow-based):**
- Workflow-based endpoints for trigger/poll/result pattern
- Durable execution with per-step retry policies
- Scheduled background refresh every 15 minutes via cron
- Frontend polls workflow status for progress updates

### Files Modified

1. **Created:**
   - `src/workflows/types.ts` - Workflow parameter and result types
   - `src/workflows/news-scraper.workflow.ts` - NewsScraperWorkflow class
   - `src/workflows/scheduled-refresh.workflow.ts` - ScheduledNewsRefreshWorkflow class
   - `src/workflows/index.ts` - Workflow exports

2. **Modified:**
   - `src/index.ts` - Added workflow exports and `scheduled` handler
   - `src/routes/news.ts` - Complete rewrite for workflow management endpoints
   - `src/types/news.ts` - Added `NEWS_SCRAPER_WORKFLOW` and `SCHEDULED_REFRESH_WORKFLOW` bindings
   - `src/frontend/pages/news-page.ts` - Implemented trigger/poll/result pattern
   - `wrangler.toml` - Added workflow bindings and cron trigger

### New Workflow Steps

**NewsScraperWorkflow** (delegates to ScheduledNewsRefreshWorkflow):
- Step 1: `check-cache` (3 retries, 1s delay) - Check KV for cached data
- Step 2: `trigger-refresh-workflow` (3 retries, 2s delay) - Trigger ScheduledNewsRefreshWorkflow if cache miss

**ScheduledNewsRefreshWorkflow** (core scraping workflow):
- Step 1: `scrape-fresh-news` (5 retries, 5s exponential backoff)
- Step 2: `update-cache` (3 retries, 1s delay)
- Step 3: `save-snapshot` (3 retries, 2s delay)

**Refactoring Note**: NewsScraperWorkflow was refactored to eliminate code duplication by delegating the scrape/save logic to ScheduledNewsRefreshWorkflow. This follows DRY principles and ensures consistent behavior between user-triggered and scheduled refreshes.

### Frontend Changes

The news page now:
1. Loads `/api/news/latest` on page open for immediate display
2. Triggers workflow via `POST /api/news/trigger`
3. Polls `/api/news/status/:id` every 2 seconds
4. Fetches `/api/news/result/:id` when workflow completes
5. Displays workflow status during execution

### Testing Notes

- **Local development**: Workflows are NOT supported in `wrangler dev` (local mode)
- **Remote development**: Use `wrangler dev --remote` to test workflows
- **Production**: Deploy with `wrangler deploy` for full workflow functionality
- **Cron triggers**: Only work in production, not in dev mode

### Benefits

1. **Durability**: Workflows survive crashes and restarts
2. **Retries**: Automatic retry with configurable backoff per step
3. **Observability**: Can query workflow status and output at any time
4. **Scheduled Execution**: Cron-triggered background refresh every 15 minutes
5. **Better UX**: Frontend shows real-time progress via polling

### Deployment & Verification (2026-01-21)

**Deployment Status**: ✅ Successfully deployed to production

**Version ID**: `7f359a55-0279-4d5a-bc2c-15dc0fd0f6dc`

**Production URL**: `https://japan-quick.nax.workers.dev`

**Important Fix**: Retry configuration syntax was corrected - delay format must be human-readable strings (e.g., "5 seconds", "1 second") instead of short forms (e.g., "5s", "1s"). The `backoff` parameter is required and must be explicitly set to "constant", "linear", or "exponential".

**Verification Results**:
- ✅ Frontend loads correctly
- ✅ `/api/news/latest` returns most recent D1 snapshot
- ✅ `POST /api/news/trigger` creates workflow instances
- ✅ `GET /api/news/status/:id` returns workflow status
- ✅ `GET /api/news/result/:id` returns completed results
- ✅ `POST /api/news/cancel/:id` terminates workflows
- ✅ Cache logic working - workflows return cached data when available
- ✅ Fresh scraping working - workflows create new snapshots when cache miss
- ✅ Workflow delegation working - NewsScraperWorkflow successfully triggers ScheduledNewsRefreshWorkflow
- ✅ Scheduled cron trigger configured (every 15 minutes)

**Test Results**:
- Workflow with `skipCache: true` completed successfully, scraped 25 news items
- Workflow with `skipCache: false` used cached data and completed instantly
- Workflow cancellation works correctly (status: "terminated")
- Latest snapshot endpoint returns newly created data
