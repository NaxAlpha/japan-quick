# Japan Quick

## Summary

Japan Quick is an AI-based video generation system running on Cloudflare Workers. It scrapes Yahoo News Japan articles, uses Gemini AI to select content and generate scripts, creates visual/audio assets, and renders videos with FFmpeg.

## File Tree

```
japan-quick/
├── public/
│   └── index.html              # Main HTML entry point with app-root custom element
├── migrations/
│   ├── 002_articles.sql        # Database migration for articles tables
│   ├── 003_videos.sql          # Database migration for videos, models, cost_logs tables
│   ├── 004_youtube_auth.sql    # Database migration for YouTube OAuth tokens
│   ├── 005_comment_reactions.sql # Database migration for comment reactions and replies
│   ├── 006_video_scripts.sql   # Database migration for video script columns
│   ├── 007_video_assets.sql    # Database migration for video assets (images, audio) and R2 storage
│   ├── 008_video_render.sql    # Database migration for video render status tracking
│   └── 009_public_assets.sql   # Database migration for ULID-based public asset system
├── src/
│   ├── index.ts                # Cloudflare Workers backend with Hono + workflow exports
│   ├── middleware/
│   │   ├── auth.ts            # Legacy Basic HTTP auth (deprecated)
│   │   └── jwt-auth.ts        # JWT authentication middleware
│   ├── lib/
│   │   ├── logger.ts           # Structured logging utility with request ID tracking
│   │   ├── html-template.ts    # HTML template utilities (with props support)
│   │   ├── db-helpers.ts       # Common SQL pattern helpers (upsertArticle, upsertArticleVersion, etc.)
│   │   ├── retry-helper.ts     # Retry logic with exponential backoff (withRetry, sleep, getRetryStatus)
│   │   ├── comment-parser.ts   # Comment extraction utilities (JSON/HTML parsing, nested replies)
│   │   ├── workflow-helper.ts  # AI workflow utilities (index mapping, cost calculation, prompt building)
│   │   ├── prompts.ts          # Centralized AI prompt templates (buildSelectionPrompt, buildScriptPrompt, buildGridImagePrompt)
│   │   ├── dimensions.ts       # Grid dimension calculations for 1K/2K resolutions
│   │   ├── image-fetcher.ts    # Fetch images from URLs and convert to base64
│   │   ├── audio-helper.ts     # Audio conversion utilities (pcmToWav, calculatePcmDuration)
│   │   └── auth.ts             # Frontend Basic Auth header generator (getAuthHeaders)
│   ├── frontend/
│   │   ├── styles/
│   │   │   └── design-system.ts # Tokyo Cyber-Industrial design tokens (Colors, Typography, Spacing, etc.)
│   │   ├── lib/
│   │   │   ├── auth.ts         # Frontend auth utilities (re-exports from auth-service)
│   │   │   └── auth-service.ts # JWT token management (login, logout, getAuthHeaders)
│   │   ├── app.ts              # LitElement root component (AppRoot)
│   │   └── pages/
│   │       ├── login-page.ts   # Login page component (Tokyo aesthetic)
│   │       ├── news-page.ts    # News page component (workflow trigger/poll/result pattern)
│   │       ├── article-page.ts # Article detail page component (Tokyo aesthetic)
│   │       ├── videos-page.ts  # Videos page component (video selection management)
│   │       ├── video-page.ts   # Video detail page component (metadata, selection, script cards)
│   │       └── settings-page.ts # Settings page component (YouTube OAuth connection)
│   ├── workflows/
│   │   ├── index.ts            # Export all workflow classes
│   │   ├── types.ts            # Workflow parameter and result types
│   │   ├── news-scraper.workflow.ts      # NewsScraperWorkflow (durable news scraping)
│   │   ├── scheduled-refresh.workflow.ts # ScheduledNewsRefreshWorkflow (cron-triggered)
│   │   ├── article-scraper.workflow.ts   # ArticleScraperWorkflow (article content scraping)
│   │   ├── article-rescrape.workflow.ts  # ArticleRescrapeWorkflow (cron-triggered rescrape)
│   │   ├── video-selection.workflow.ts   # VideoSelectionWorkflow (AI video selection, cron-triggered)
│   │   ├── script-generation.workflow.ts # ScriptGenerationWorkflow (async script generation)
│   │   ├── asset-generation.workflow.ts  # AssetGenerationWorkflow (async asset generation)
│   │   └── video-render.workflow.ts      # VideoRenderWorkflow (FFmpeg video composition)
│   ├── services/
│   │   ├── news-scraper.ts           # Yahoo News Japan scraper (filters pickup URLs only, with thorough logging)
│   │   ├── article-scraper.ts        # Yahoo News article scraper (full content + comments)
│   │   ├── article-scraper-core.ts   # Core article scraping logic (serial processing)
│   │   ├── gemini.ts                 # Gemini AI service (uses prompts.ts for AI prompts)
│   │   ├── asset-generator.ts        # Asset generation service (uses prompts.ts and audio-helper.ts)
│   │   ├── video-renderer.ts         # FFmpeg video rendering in Cloudflare Sandbox
│   │   ├── r2-storage.ts             # R2 storage service (upload, retrieve, delete assets)
│   │   ├── youtube-auth.ts           # YouTube OAuth 2.0 service (token management, channel operations)
│   │   └── jwt-auth.ts              # JWT token generation and verification service
│   ├── types/
│   │   ├── news.ts             # News type definitions + Env type (single source of truth)
│   │   ├── article.ts          # Article type definitions
│   │   ├── video.ts            # Video type definitions (Video, Model, CostLog, ImageSize, ImageDimensions)
│   │   └── youtube.ts          # YouTube OAuth type definitions
│   ├── routes/
│   │   ├── auth.ts            # JWT auth routes (login, me, logout)
│   │   ├── news.ts            # API routes for news workflow management
│   │   ├── articles.ts        # API routes for article management
│   │   ├── videos.ts          # API routes for video workflow management
│   │   ├── youtube.ts         # API routes for YouTube OAuth (status, auth URL, callback, refresh, disconnect)
│   │   └── frontend.ts        # Frontend route handlers (/, /login, /news, /article/:id, /videos, /video/:id, /settings)
│   └── tests/
│       ├── unit/               # Unit tests for services, routes, lib
│       │   └── lib/
│       │       └── dimensions.test.ts  # Tests for dimension utility
│       └── integration/        # Integration tests (e.g., news-e2e.test.ts)
├── scripts/
│   └── verify-asset-generation.ts  # Verification script for asset generation improvements
├── tsconfig.json               # TypeScript config for backend (Cloudflare Workers)
├── tsconfig.frontend.json      # TypeScript config for frontend (browser)
├── vitest.config.ts            # Vitest config with Cloudflare Workers pool
├── wrangler.toml               # Cloudflare Workers configuration + auth credentials
├── Dockerfile.ffmpeg           # FFmpeg container for video rendering (cloudflare/sandbox:0.7.0)
└── package.json                # Dependencies and scripts
```

## Architecture

**Stack:** Hono + Cloudflare Workers + Lit web components + D1 + R2
- Entry: `src/index.ts` with JWT authentication on `/api/*` routes
- Database: See `migrations/` for D1 table schemas
- Storage: R2 with ULID-based flat storage at bucket root: `{ulid}.{ext}`
- Public URLs: `https://japan-quick-assets.nauman.im/{ulid}.ext`
- Asset types: slide_image, slide_audio, rendered_video

**Workflows** (`src/workflows/`): Durable execution with retry policies. Test with `wrangler dev --remote` or deploy to production.

## Cloudflare Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| BROWSER | Browser Binding | Puppeteer-based scraping |
| NEWS_CACHE | KV Namespace | Cache (35min TTL) + OAuth state |
| DB | D1 Database | SQLite storage |
| ASSETS_BUCKET | R2 Bucket | Video assets |
| *_WORKFLOW | Workflow | Durable workflows (8 types) |
| ADMIN_USERNAME/PASSWORD | Var | Admin credentials (login) |
| JWT_SECRET | Secret | JWT signing key |
| GOOGLE_API_KEY | Secret | Gemini API key |
| YOUTUBE_CLIENT_ID/SECRET/REDIRECT_URI | Secret | YouTube OAuth credentials |

## Commands

```bash
bun install                 # Install dependencies
bun run build:frontend      # Build frontend TypeScript
bun run dev                 # Local dev server
wrangler dev --remote       # Remote dev (for workflows)
bun run test                # Run tests
bun run deploy              # Deploy to Cloudflare Workers
wrangler tail --format pretty  # Tail logs
```

## Logging

**Format:** `[reqId] [timestamp] [level] [component] message | key=value`

**Components:** newsRoutes, newsWorkflow, newsScraper, articleRoutes, articleWorkflow, articleScraper, videoRoutes, videoWorkflow, gemini, scriptGeneration, assetGen, assetRoutes, youtubeRoutes, youtubeAuth, auth

**Usage:**
```typescript
import { log, generateRequestId } from '../lib/logger.js';

const reqId = generateRequestId();
log.gemini.info(reqId, 'Operation started', { videoId: '123' });
```

**Guidelines:**
- Generate reqId once per request/workflow, pass through all calls
- Include relevant IDs: pickId, videoId, articleId, workflowId
- Include durationMs for timed operations
- Use INFO for key operations, ERROR with error object for failures

## Authentication

**JWT-based authentication** on `/api/*` routes only. Frontend pages are public.

### Login Flow

1. **Browser:** Visit `/login` and enter credentials
2. **API:** Call `POST /api/auth/login` with username/password
3. **Token:** Server returns signed JWT (7 day expiry)
4. **Storage:** Token stored in localStorage as `japan_quick_auth_token`
5. **API Requests:** All requests include `Authorization: Bearer <token>`

### Credentials Storage

- **Location:** `wrangler.toml` under `[vars]` ONLY
- **Keys:** `ADMIN_USERNAME`, `ADMIN_PASSWORD`
- **Rotation:** Update values in wrangler.toml and redeploy

### cURL Example

```bash
# Login (password matches wrangler.toml)
TOKEN=$(curl -s -X POST https://japan-quick.nax.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"PASSWORD_FROM_TOML"}' \
  | jq -r '.data.token')

# Use token for API requests
curl https://japan-quick.nax.workers.dev/api/videos \
  -H "Authorization: Bearer $TOKEN"
```

### Protected Endpoints

All `/api/*` routes require JWT authentication:
- `/api/videos/*` - Video operations
- `/api/news/*` - News scraping
- `/api/articles/*` - Article operations
- `/api/youtube/*` - YouTube OAuth

### Environment Variables

- `JWT_SECRET` (secret) - JWT signing key (set via `wrangler secret put`)
- `ADMIN_USERNAME` (var) - Admin username (in wrangler.toml)
- `ADMIN_PASSWORD` (var) - Admin password (in wrangler.toml)

**Secrets:** `GOOGLE_API_KEY`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`, `JWT_SECRET`
- Managed via: `echo $VALUE | wrangler secret put KEY`

## Database

**D1 Tables:** See `migrations/` for full schemas

- **news_snapshots** - Captured news data snapshots
- **articles** - Article metadata and status tracking
  - Status: pending | not_available | retry_1 | retry_2 | error | scraped_v1 | scraped_v2
- **article_versions** - Article content at v1 and v2 scrapes
- **article_comments** - Comments with reactions (empathized, understood, questioning) and nested replies
- **videos** - Video metadata, scripts, assets, status tracking
  - video_type: short (60-120s, 1080x1920) | long (4-6min, 1920x1080)
  - script_status: pending | generating | generated | error
  - asset_status: pending | generating | generated | error
  - render_status: pending | rendering | rendered | error
- **cost_logs** - AI operation cost tracking
- **video_assets** - R2 asset storage records (ULID-based)
  - asset_type: grid_image | slide_image | slide_audio | rendered_video
- **models** - AI model pricing configuration
- **youtube_auth** - YouTube OAuth tokens

## Yahoo News Scraper

**URL Filtering:** Only pickup URLs (`/pickup/\d{7}`)

**Strategies:**
- Browser Mode (Production): Cloudflare Browser Binding with Puppeteer
- Two-Pass Scraping: v1 immediately, v2 after 1 hour

**Content Extraction:**
- Semantic HTML selectors (`article h1`, `.article_body`)
- Comment extraction via JSON (`window.__PRELOADED_STATE__`) or HTML parsing
- Reaction counts: empathized, understood, questioning
- Nested replies expansion

**Browser Binding Best Practices:**
- Use `puppeteer.launch(browserBinding)` pattern
- Always call `browser.disconnect()` (NOT `close()`) for session reuse
- Add `compatibility_flags = ["nodejs_compat"]` to wrangler.toml

## Gemini AI

**Models:**
- Selection/Scripts: `gemini-3-flash-preview` ($0.50/$3.00 per 1M tokens)
- Images: `gemini-2.5-flash-image` ($0.039 each) or `gemini-3-pro-image-preview` ($0.134 each)
- TTS: `gemini-2.5-flash-preview-tts` or `gemini-2.5-pro-preview-tts`

**Article Selection:**
- Criteria: Importance, Timeliness, Clarity, Visual Potential, Engagement
- Output: notes, short_title, articles (pick_ids), video_type
- AI must select at least one article

**Script Generation:**
- Input: Articles with content, comments, images
- Output: VideoScript (title, description, thumbnailDescription, slides[])
- Slide counts: 6-8 (short), 15-17 (long)
- Language rules: Article text in article language, image descriptions in English

**Cost Tracking:** All operations logged to `cost_logs` table

## Video Asset Generation

**Grid Images:**
- 3×3 grids containing slide images + thumbnail
- Resolutions: 1K (Flash model) or 2K (Pro model)
- Short: 1 grid (1080×1920 or 2048×3658)
- Long: 2 grids (1920×1080 or 3658×2048 each)
- Reference images included for AI context

**Grid Splitting:**
- Individual slides extracted using `cross-image` library (pure JavaScript, zero dependencies)
- Uploaded to R2 with ULID-based keys
- Stored as `slide_image` asset type

**TTS Audio:**
- 30 available voices (randomly selected, stored in `videos.tts_voice`)
- Generated per slide narration
- Converted from PCM to WAV format
- Uploaded to R2 with ULID keys

**Storage:**
- Flat ULID-based structure: `{ulid}.{ext}`
- Public URLs: `https://japan-quick-assets.nauman.im/{ulid}.ext`
- Asset IDs tracked in `videos.slide_image_asset_ids` and `slide_audio_asset_ids` (JSON arrays)

## Video Rendering

**Architecture:** FFmpeg in Cloudflare Sandbox with ULID-based public assets
- Service: `src/services/video-renderer.ts`
- Workflow: `src/workflows/video-render.workflow.ts`
- Container: `Dockerfile.ffmpeg` (based on cloudflare/sandbox:0.7.0)
- Process: Download slide images/audio → FFmpeg composition → Upload to R2

**Key Details:**
- Individual slide images (not grid crops)
- Ken Burns zoom (alternating in/out), xfade transitions
- Japanese date badge overlay (Noto Sans CJK fonts)
- WebM output (VP9/Opus, 25fps)
- Assets downloaded via curl inside sandbox (no base64 encoding)
- Strict 1:1 slide/audio validation - renderer validates counts match before rendering
- Audio filter indices calculated from slideCount (audioStartIndex = slidePaths.length)
- Grid splitting uses metadata.positions for correct slide indices (prevents duplicates)

**Dockerfile Requirements:**
- Base image: `docker.io/cloudflare/sandbox:0.7.0` (must match SDK version)
- CMD: `["bun", "/container-server/dist/index.js"]` (required for control plane)
- Instance type: `basic` (4GB disk)

## YouTube OAuth

**Scopes:**
- youtube.upload, youtube, yt-analytics.readonly

**Flow:**
1. User clicks "Connect YouTube Channel" on `/settings`
2. Backend generates OAuth URL with state (stored in KV, 5min TTL)
3. User approves at Google consent screen
4. Google redirects to `/api/youtube/oauth/callback`
5. Backend exchanges code for tokens, stores in `youtube_auth` table
6. User redirected to `/settings?success=connected`

**Token Management:**
- Access token: 1 hour expiry
- Refresh token: Long-lived, used for renewals
- Auto-refresh when < 5 minutes remaining
- Manual refresh via settings button

## Design System

**Tokyo Cyber-Industrial** aesthetic defined in `src/frontend/styles/design-system.ts`:

- **Fonts:** Zen Tokyo Zoo (display), Inter + Noto Sans JP (body), Space Mono (mono)
- **Colors:** High contrast monochrome with electric red accent (#e63946)
- **Borders:** Sharp 3px borders, no rounded corners
- **Shadows:** Brutalist offset (2px 2px 0, 4px 4px 0)
- **Patterns:** Subtle seigaiha (wave) background

## Platform Notes

### Cloudflare Workers
- Static files served via `[assets]` in wrangler.toml (NOT `serveStatic`)
- Workflows require `wrangler dev --remote` or production deployment
- Cron triggers only work in production

### Browser Binding
- Use `puppeteer.launch(browserBinding)` (never call methods directly on binding)
- Always `browser.disconnect()` (NOT `close()`) for session reuse
- Requires `compatibility_flags = ["nodejs_compat"]` in wrangler.toml

### Sandbox Containers
- Docker image version MUST match SDK version (0.7.0)
- Container MUST have CMD to start control plane
- Wait 2-3 minutes after deployment for provisioning

### Frontend Build
- Build TypeScript with `bun run build:frontend` before dev
- Deployment automatically builds frontend
- `useDefineForClassFields: false` required for Lit decorators

## Cloudflare Account

- **Account ID:** `ccccd0d9d16426ee80bf27b0c0b8a9cb`
- **Production URL:** `https://japan-quick.nax.workers.dev`
- **Worker Subdomain:** `nax.workers.dev`
- **Assets Domain:** `https://japan-quick-assets.nauman.im`

## Workflow Scheduling

- **Hourly Cron:** ScheduledNewsRefreshWorkflow, ArticleRescrapeWorkflow
- **Business Hours Only (JST 8am-8pm):** VideoSelectionWorkflow
- **Stale Status Handling:** Auto-reset 'generating' status older than 10 minutes
- **Empty Snapshot Prevention:** Workflows skip saving snapshots when 0 items scraped; manual trigger returns error for empty results

## Development Patterns

- RESTful API with Hono
- Web Components with Lit, scoped CSS
- Full TypeScript with strict mode
- ES modules throughout
- Vitest with Cloudflare Workers pool
- Structured logging with request ID correlation
- Workflow status polling (2.5-3s intervals)

## Type System

**Env Type:** Single source of truth in `src/types/news.ts`
- Defines all Cloudflare Workers bindings
- Used throughout backend for type safety

**Video Types:**
- VideoScript: title, description, thumbnailDescription, slides[]
- Slide: headline, imageDescription, audioNarration, estimatedDuration
- VideoType: 'short' | 'long'
- ImageSize: '1K' | '2K'

## Testing & Verification

**Local:** `bun run dev` (workflows not supported)
**Remote:** `wrangler dev --remote` (workflows supported)
**Production:** `bun run deploy` (full functionality including cron)

**Verification Steps:**
1. Deploy: `bun run deploy` (note version ID)
2. Tail logs: `wrangler tail --format pretty`
3. Test endpoints/workflows via curl/browser
4. Verify logs show no errors, expected behavior
5. Report results with version ID

## Dependencies

**Key Packages:**
- `hono` - Web framework
- `lit` - Web components
- `@google/genai` - Gemini AI client
- `@cloudflare/puppeteer` - Browser scraping
- `cross-image` - Pure JS image processing (grid splitting)
- `ulid` - ULID generation for asset IDs
- `vitest` - Testing framework

## Migration History

- 002: articles tables
- 003: videos, models, cost_logs
- 004: youtube_auth
- 005: comment_reactions
- 006: video_scripts
- 007: video_assets
- 008: video_render
- 009: public_assets (ULID-based system)
