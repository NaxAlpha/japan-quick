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
│   └── 002_articles.sql        # Database migration for articles tables
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
│   │   └── article-rescrape.workflow.ts  # ArticleRescrapeWorkflow (cron-triggered rescrape)
│   ├── frontend/
│   │   ├── app.ts              # LitElement root component (AppRoot)
│   │   └── pages/
│   │       ├── news-page.ts    # News page component (workflow trigger/poll/result pattern)
│   │       └── article-page.ts # Article detail page component
│   ├── services/
│   │   ├── news-scraper.ts     # Yahoo News Japan scraper (filters pickup URLs only)
│   │   └── article-scraper.ts  # Yahoo News article scraper (full content + comments)
│   ├── types/
│   │   ├── news.ts             # News type definitions + Env type (single source of truth)
│   │   └── article.ts          # Article type definitions
│   ├── routes/
│   │   ├── news.ts             # API routes for news workflow management
│   │   ├── articles.ts         # API routes for article management
│   │   └── frontend.ts         # Frontend route handlers
│   ├── lib/
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
  - `GET /api/status` - Service status endpoint (protected)
  - `GET /api/hello` - Health check/JSON API endpoint (protected)
  - **News Workflow Routes (protected):**
    - `POST /api/news/trigger` - Create new workflow instance
    - `GET /api/news/status/:id` - Get workflow status
    - `GET /api/news/result/:id` - Get completed workflow result
    - `GET /api/news/latest` - Get most recent D1 snapshot with article status
    - `POST /api/news/cancel/:id` - Terminate workflow
  - **Article API Routes (protected):**
    - `GET /api/articles/:id` - Get article by pick:xxx or article_id
    - `GET /api/articles/:id/version/:version` - Get specific version
    - `POST /api/articles/trigger/:pickId` - Manual trigger
    - `GET /api/articles/status/:workflowId` - Workflow status

### Frontend (Lit + TypeScript)

- Entry point: `public/index.html`
- Framework: Lit (Web Components)
- Components:
  - `<app-root>`: Home page with navigation and API test button
  - `<news-page>`: News scraping interface with article status badges
  - `<article-page>`: Article detail view with version selector
- Build output: `public/frontend/` directory (from TypeScript compilation)
- Styling: Scoped CSS within Lit components
- Purpose: Provides interface for content generation, preview, and management

### Cloudflare Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `BROWSER` | Browser Binding | Puppeteer-based scraping in production |
| `NEWS_CACHE` | KV Namespace | Cache scraped news for 35 minutes |
| `DB` | D1 Database | Store news snapshots and articles |
| `NEWS_SCRAPER_WORKFLOW` | Workflow | Durable news scraping workflow |
| `SCHEDULED_REFRESH_WORKFLOW` | Workflow | Cron-triggered background refresh workflow |
| `ARTICLE_SCRAPER_WORKFLOW` | Workflow | Article content scraping workflow |
| `ARTICLE_RESCRAPE_WORKFLOW` | Workflow | Cron-triggered article rescrape workflow |
| `ADMIN_USERNAME` | Var | Basic auth username |
| `ADMIN_PASSWORD` | Var | Basic auth password |

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

Cron-triggered background refresh (every 30 minutes):
- `scrape-fresh-news` - Always scrape fresh (no cache check)
- `update-cache` - Update KV cache
- `save-snapshot` - Save to D1

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

**Note**: Workflows require remote deployment to test - use `wrangler dev --remote` or `wrangler deploy`. Cron triggers only work in production.

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
    ARTICLE_SCRAPER_WORKFLOW: Workflow;
    ARTICLE_RESCRAPE_WORKFLOW: Workflow;
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

### Testing & Verification

- **Local development**: Workflows are NOT supported in `wrangler dev` (local mode)
- **Remote development**: Use `wrangler dev --remote` to test workflows
- **Production**: Deploy with `wrangler deploy` for full workflow functionality
- **Cron triggers**: Only work in production, not in dev mode

## Cloudflare Account Information

- **Account ID**: `ccccd0d9d16426ee80bf27b0c0b8a9cb`
- **Production URL**: `https://japan-quick.nax.workers.dev`
- **Worker Subdomain**: `nax.workers.dev`

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
```

- **news_snapshots.data**: JSON string containing the full YahooNewsResponse
- **articles.status**: pending | not_available | retry_1 | retry_2 | error | scraped_v1 | scraped_v2
- **article_versions.version**: 1 (first scrape) or 2 (rescrape after 1 hour)

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
