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
│   ├── 009_public_assets.sql   # Database migration for ULID-based public asset system
│   ├── 010_video_selection_v2.sql  # Database migration for enhanced video selection
│   └── 012_youtube_upload.sql  # Database migration for YouTube upload status and metadata
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
│   │   ├── prompts.ts          # Centralized AI prompt templates (buildSelectionPrompt, buildEnhancedSelectionPrompt, buildScriptPrompt, buildScriptPromptEnhanced, buildGridImagePrompt)
│   │   ├── dimensions.ts       # Grid dimension calculations for 1K/2K resolutions
│   │   ├── image-fetcher.ts    # Fetch images from URLs and convert to base64
│   │   ├── audio-helper.ts     # Audio conversion utilities (pcmToWav, calculatePcmDuration)
│   │   └── auth.ts             # Frontend Basic Auth header generator (getAuthHeaders)
│   ├── frontend/
│   │   ├── components/
│   │   │   ├── video-youtube-upload-card.ts  # YouTube upload card component
│   │   │   └── ...             # Other video-related components
│   │   ├── styles/
│   │   │   └── design-system.ts # Tokyo Cyber-Industrial design tokens (Colors, Typography, Spacing, etc.)
│   │   ├── lib/
│   │   │   ├── auth.ts         # Frontend auth utilities (re-exports from auth-service)
│   │   │   ├── auth-service.ts # JWT token management (login, logout, getAuthHeaders)
│   │   │   └── polling.ts      # Polling utility for async operations
│   │   ├── app.ts              # LitElement root component (AppRoot)
│   │   └── pages/
│   │       ├── login-page.ts   # Login page component (Tokyo aesthetic)
│   │       ├── news-page.ts    # News page component (workflow trigger/poll/result pattern)
│   │       ├── article-page.ts # Article detail page component (Tokyo aesthetic)
│   │       ├── videos-page.ts  # Videos page component (video selection management)
│   │       ├── video-page.ts   # Video detail page component (metadata, selection, script, render, upload cards)
│   │       └── settings-page.ts # Settings page component (YouTube OAuth connection)
│   ├── workflows/
│   │   ├── index.ts            # Export all workflow classes
│   │   ├── types.ts            # Workflow parameter and result types
│   │   ├── news-scraper.workflow.ts      # NewsScraperWorkflow (durable news scraping)
│   │   ├── scheduled-refresh.workflow.ts # ScheduledNewsRefreshWorkflow (cron-triggered)
│   │   ├── article-scraper.workflow.ts   # ArticleScraperWorkflow (article content scraping)
│   │   ├── article-rescrape.workflow.ts  # ArticleRescrapeWorkflow (cron-triggered rescrape)
│   │   ├── video-selection.workflow.ts   # VideoSelectionWorkflow (AI video selection with prompt storage, cron-triggered)
│   │   ├── script-generation.workflow.ts # ScriptGenerationWorkflow (async script generation)
│   │   ├── asset-generation.workflow.ts  # AssetGenerationWorkflow (async asset generation)
│   │   ├── video-render.workflow.ts      # VideoRenderWorkflow (FFmpeg video composition)
│   │   ├── youtube-upload.workflow.ts    # YouTubeUploadWorkflow (YouTube video upload via resumable upload API)
│   │   └── test-chunked.workflow.ts      # TestChunkedWorkflow (R2 multipart upload test)
│   ├── services/
│   │   ├── news-scraper.ts           # Yahoo News Japan scraper (filters pickup URLs only, with thorough logging)
│   │   ├── article-scraper.ts        # Yahoo News article scraper (full content + comments)
│   │   ├── article-scraper-core.ts   # Core article scraping logic (serial processing)
│   │   ├── gemini.ts                 # Gemini AI service (uses prompts.ts for AI prompts)
│   │   ├── asset-generator.ts        # Asset generation service (uses prompts.ts and audio-helper.ts)
│   │   ├── video-renderer.ts         # FFmpeg video rendering in Cloudflare Sandbox
│   │   ├── r2-storage.ts             # R2 storage service (upload, retrieve, delete assets)
│   │   ├── youtube-auth.ts           # YouTube OAuth 2.0 service (token management, channel operations)
│   │   ├── youtube-upload.ts         # YouTube upload service (resumable upload, chunked upload, processing poll)
│   │   └── jwt-auth.ts              # JWT token generation and verification service
│   ├── types/
│   │   ├── news.ts             # News type definitions + Env type (single source of truth)
│   │   ├── article.ts          # Article type definitions
│   │   ├── video.ts            # Video type definitions (Video, Model, CostLog, ImageSize, ImageDimensions, YouTubeUploadStatus, YouTubeInfo)
│   │   └── youtube.ts          # YouTube OAuth type definitions (plus upload types: YouTubeUploadSession, YouTubeUploadOptions, YouTubeInfo)
│   ├── routes/
│   │   ├── auth.ts            # JWT auth routes (login, me, logout)
│   │   ├── news.ts            # API routes for news workflow management
│   │   ├── articles.ts        # API routes for article management
│   │   ├── videos.ts          # API routes for video workflow management (including YouTube upload endpoints)
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
├── .e2b/                       # E2B sandbox template for video rendering
│   ├── template.ts             # E2B template definition (ffmpeg, curl, fonts)
│   └── build.ts                # Template build script (8 CPU, 8GB RAM, 16GB disk)
└── package.json                # Dependencies and scripts (e2b@^2.11.0)
```

## Architecture

**Stack:** Hono + Cloudflare Workers + Lit web components + D1 + R2
- Entry: `src/index.ts` with JWT authentication on `/api/*` routes
- Database: See `migrations/` for D1 table schemas
- Storage: R2 with ULID-based flat storage at bucket root: `{ulid}.{ext}`
- Public URLs: `https://japan-quick-assets.nauman.im/{ulid}.ext`
- Asset types: slide_image, slide_audio, rendered_video

**Workflows** (`src/workflows/`): Durable execution with retry policies.
- Test with `wrangler dev --remote` or deploy to production
- Chunked video transfer via R2 multipart upload (15MB chunks, one at a time)

## Cloudflare Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| BROWSER | Browser Binding | Puppeteer-based scraping |
| NEWS_CACHE | KV Namespace | Cache (35min TTL) + OAuth state |
| DB | D1 Database | SQLite storage |
| ASSETS_BUCKET | R2 Bucket | Video assets |
| *_WORKFLOW | Workflow | Durable workflows (10 types) |
| ADMIN_USERNAME/PASSWORD | Var | Admin credentials (login) |
| JWT_SECRET | Secret | JWT signing key |
| E2B_API_KEY | Secret | E2B sandbox API key |
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

# Test chunked upload
wrangler workflows trigger test-chunked-workflow --params '{"testSize":75}'
wrangler workflows instances describe test-chunked-workflow <instance-id>
```

## Logging

**Format:** `[reqId] [timestamp] [level] [component] message | key=value`

**Components:** newsRoutes, newsWorkflow, newsScraper, articleRoutes, articleWorkflow, articleScraper, videoRoutes, videoWorkflow, gemini, scriptGeneration, assetGen, assetRoutes, youtubeRoutes, youtubeAuth, youTubeUpload, youTubeUploadWorkflow, auth

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
  - video_format: single_short | multi_short | long
  - urgency: urgent | developing | regular
  - script_status: pending | generating | generated | error
  - asset_status: pending | generating | generated | error
  - render_status: pending | rendering | rendered | error
  - youtube_upload_status: pending | uploading | processing | uploaded | error
- **cost_logs** - AI operation cost tracking
- **video_assets** - R2 asset storage records (ULID-based)
  - asset_type: grid_image | slide_image | slide_audio | rendered_video | selection_prompt | script_prompt | image_generation_prompt | thumbnail_image
  - thumbnail_image: YouTube thumbnail extracted from grid (pro model) or generated separately (non-pro model)
- **models** - AI model pricing configuration
- **youtube_auth** - YouTube OAuth tokens
- **youtube_info** - YouTube video metadata (video_id, youtube_video_id, url, title, description, tags, privacy, etc.)

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
- Selection: `gemini-3-flash-preview` ($0.50 input/$3.00 output per 1M tokens)
- Enhanced Script: `gemini-3-pro-preview` ($2.00 input/$12.00 output per 1M tokens)
- Basic Script: `gemini-3-flash-preview` ($0.50 input/$3.00 output per 1M tokens)
- Images: `gemini-2.5-flash-image` ($0.039 each, 1K individual slides) or `gemini-3-pro-image-preview` ($0.24 each, 4K grids)
- TTS: `gemini-2.5-flash-preview-tts` or `gemini-2.5-pro-preview-tts`

**Article Selection:**
- Basic: buildSelectionPrompt() - Simple article selection with basic criteria
- Enhanced: buildEnhancedSelectionPrompt() - Advanced selection with scheduling context, past 24h history, content previews, video format options (single_short/multi_short/long), urgency levels (video uploaded immediately)
- Criteria: Importance, Timeliness, Clarity, Visual Potential, Engagement, Novelty
- Output: notes, short_title, articles (pick_ids), video_format, urgency
- Token usage: ~500-1000 (basic) vs ~35k-40k (enhanced with content)
- **Prompt Storage**: Enhanced selection prompt saved to R2 as selection_prompt asset (viewable in UI via "View Selection Prompt" button)
- AI must select at least one article

**Script Generation:**
- **Enhanced**: buildScriptPromptEnhanced() - Single unified prompt with ALL context
  - Uses gemini-3-pro-preview model for better quality
  - Input: videoFormat, urgency, timeContext, articles with content/comments/images
  - **Single unified prompt approach**: All context provided to AI, AI decides style/examples based on video format, urgency, and content (no code-selected fragments)
  - **Title examples in Japanese**: Format-specific guidelines with Japanese examples
    - single_short: "東京で震度5強の地震、緊急地震速報発表"
    - multi_short: "今日の日本テック業界3つの重大ニュース"
    - long: "【徹底解説】日本の新経済政策があなたに与える影響"
  - **Extremely detailed image descriptions**: Composition, lighting, background, subject details, visual consistency, exact Japanese text on images, cultural accuracy
  - **Enhanced thumbnail design**: Neon/borders, arrows, lens flares, high contrast
  - **TTS director's notes**: Each slide includes audioProfile (urgent/calm/excited/serious/casual/dramatic) and directorNotes for smooth audio flow across slides
  - **Language rules**: ALL text fields in Japanese (title, description, headline, audioNarration), image descriptions in English
  - Channel name: "J-Quick"
  - Fact integrity rule: ONLY use facts from source articles
  - **Prompt Storage**: Script prompt saved to R2 as script_prompt asset (viewable in UI via "View Script Prompt" button)
- **Basic**: buildScriptPrompt() - Legacy fallback for videos without enhanced metadata
  - Uses gemini-3-flash-preview model
  - Input: videoType (short/long), articles
  - Slide counts: 6-8 (short), 15-17 (long)

**TTS Audio Generation:**
- **Enhanced**: generateSlideAudio() with director's notes
  - Accepts optional `directorNotes` and `audioProfile` parameters from script slides
  - Builds enhanced prompt with AUDIO PROFILE and DIRECTOR'S NOTES sections
  - Profile guidance: urgent (fast-paced), calm (measured), excited (energetic), serious (grave), casual (relaxed), dramatic (heightened emotion)
  - Ensures smooth audio flow across slides by providing style context to TTS model
  - **Returns token usage**: inputTokens, outputTokens, totalTokens extracted from response.usageMetadata

**Parallel Audio Generation:**
- Audio generated using parallel queue pattern with concurrency limits
- **Pro Model** (gemini-2.5-pro-preview-tts): 10 concurrent requests (125 QPM rate limit)
- **Flash Model** (gemini-2.5-flash-preview-tts): 25 concurrent requests (1,502 QPM rate limit)
- Each successful audio generation is immediately saved to database
- Failures don't rollback successful audio - partial failures reported in error summary

**Cost Tracking:** All operations logged to `cost_logs` table
- Image generation: `log_type = 'image-generation'`
- Audio generation: `log_type = 'audio-generation'` (NEW - includes slideIndex for per-slide tracking)

## Video Asset Generation

**Model-Based Generation:**
- Pro Model (gemini-3-pro-image-preview): Grid generation with 4K resolution by default
- Non-Pro Model (gemini-2.5-flash-image): Individual slide generation with 1K resolution
- Frontend defaults to pro model when assets are pending

**Grid Images (Pro Model):**
- 3×3 grids containing slide images + thumbnail
- 4K resolution: 3072×5504 (9:16) or 5504×3072 (16:9)
- Short: 1 grid, Long: 2 grids
- Reference images included for AI context
- Prompts stored as `image_generation_prompt` assets for viewing
- **Grid padding:** When slide count < 8 (short) or < 16 (long), empty positions between last slide and thumbnail are explicitly filled with "plain solid black" descriptions to ensure complete 3×3 grid generation for proper cropping
- **Thumbnail extraction:** After grid splitting, thumbnail extracted from position 8 of appropriate grid (grid 0 for short, grid 1 for long)

**Individual Slides (Non-Pro Model):**
- Each slide generated separately
- 1K resolution: 768×1344 (9:16) or 1344×768 (16:9)
- No grid generation, no prompt storage
- **Separate thumbnail generation:** Custom thumbnail generated using `generateThumbnailImage()` method with 16:9 aspect ratio

**Grid Splitting:**
- **Uses E2B sandbox with ImageMagick** for 4K grid splitting (avoids Workers 128MB memory limit)
- Service: `src/services/asset-generator.ts` - `splitGridsIntoSlides()` method
- Template: `video-renderer` (includes ImageMagick via apt-install)
- Process: Write grid base64 to sandbox → `convert -crop 3x3` → Read split files → Upload to R2 (streaming pattern)
- Uploaded to R2 with ULID-based keys
- Stored as `slide_image` asset type
- **Streaming pattern:** Read one slide file at a time, upload immediately, discard buffer to minimize memory usage

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

**Architecture:** Remotion in E2B sandbox with ULID-based public assets
- Service: `src/services/video-renderer.ts`
- Workflow: `src/workflows/video-render.workflow.ts`
- Template: `.e2b/template.ts` (Bun + Remotion template)
- Process: Download assets to public/ → Write inputProps JSON → Execute `remotion render` → Read base64 → Upload to R2

**E2B Configuration:**
- Template: `video-renderer` (8 CPU, 8GB RAM, 16GB disk)
- Base: Bun 1.3 image via `.fromBunImage('1.3')`
- Pre-installed: Remotion 4.0.414, FFmpeg, ImageMagick, Chromium, fonts-noto-cjk-extra, curl
- Remotion project: `/home/user/remotion` with all dependencies
- Build script: `.e2b/build.ts`
- Timeout: 40 minutes (2400000ms for sandbox, 20 minutes for workflow step)

**Remotion Project:**
- Location: `.e2b/remotion-template/`
- Components: Slide, BackgroundAnimation, DateBadge, SlideTitle
- Dynamic composition: DynamicVideo accepts inputProps (slides[], videoType, articleDate)
- Assets: Pre-downloaded to `public/` directory as local files (not remote URLs)
- Image format: JPEG at 90% quality (memory-efficient, good quality)

**Resolution Settings (Worker Memory Constraints):**
- **Current: 720p** (scale 0.667 from 1080p) with chunked R2 multipart upload
- Short videos: 720x1280 (portrait)
- Long videos: 1280x720 (landscape)
- Output format: MP4 (H.264/AAC)
- File size: ~40-45 MB for 3-4 minute video (base64 ~55-60 MB total, split into 15MB chunks)
- Render time: ~7-10 minutes
- Transfer: Chunked upload via R2 multipart API (15MB chunks, one at a time)

**Key Details:**
- MP4 output (H.264/AAC, 30fps) - better compatibility than WebM
- Ken Burns zoom (alternating in/out)
- 30-frame cross-fade transitions (1s at 30 FPS)
- Date badge overlay (DD MMM YYYY format)
- Headline overlays with fade-underline animation
- **Chunked transfer for files > 25MB:** E2B splits video with `dd`, returns chunks as base64
- **R2 multipart upload:** `createMultipartUpload()` → `uploadPart()` (loop) → `complete()`
- Strict 1:1 slide/audio validation

**Chunked Transfer Implementation:**
- Worker memory limit: 128MB
- Base64 encoding overhead: ~33%
- Solution: R2 multipart upload with 15MB chunks
  - E2B splits rendered video using `dd` command
  - Each chunk (15MB raw → ~20MB base64) fits in Worker memory
  - Chunks uploaded sequentially via `multipartUpload.uploadPart()`
  - Workflow completes upload with `multipartUpload.complete()`
- 720p video: ~40-45 MB → ~55-60 MB base64 (3 chunks ✅)
- 1080p video: ~70-80 MB → ~95-105 MB base64 (5-6 chunks ✅)

**E2B Template Management:**
```bash
# Build template (from .e2b directory)
cd .e2b && bun run build.ts

# Rebuilds on template.ts changes
```

**Performance:**
- Template build: ~100s (cached after first build)
- Sandbox creation: ~1-2s
- First render includes Chromium download (~109MB)
- Subsequent renders use cached browser
- 270p videos render in ~7 minutes

**Memory Optimization (CRITICAL):**
Remotion components require React performance patterns to avoid memory leaks during long renders:
- All components wrapped in `React.memo` to prevent unnecessary re-renders
- Inline styles replaced with constant style objects (see `src/styles.ts`)
- Expensive computations (interpolations, URL resolution) wrapped in `useMemo`
- Binary-to-base64 conversion uses `Buffer.from()` not string concatenation

**Without these optimizations**, memory grows linearly and crashes at ~58% (14-25% complete). **With optimizations**, memory plateaus at ~20% during rendering and completes successfully.

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

## YouTube Upload

**Workflow:** `YouTubeUploadWorkflow` - Async upload via Cloudflare Workflow

**Process:**
1. Fetch video with script from D1
2. Fetch rendered video asset from R2
3. Create YouTube resumable upload session
4. Upload video in 256KB chunks (streaming from R2, no full download)
5. **Upload thumbnail to YouTube** (thumbnail_image asset from R2)
6. Poll for YouTube processing completion
7. Store YouTube metadata in `youtube_info` table

**Resumable Upload Protocol (IMPORTANT):**
- Chunk size: 256KB (262,144 bytes) - MUST be multiples of 256KB except final chunk
- Offset tracking: MUST parse `Range` header from YouTube's 308 response
- The 308 response contains `Range: bytes=0-XXXX` indicating actual bytes received
- **Never assume entire chunk was uploaded** - always read Range header
- If Range header missing, fall back to assuming chunk was uploaded

**Service:** `src/services/youtube-upload.ts`
- `createUploadSession()` - Initiates resumable upload, returns upload URL
- `uploadVideoStream()` - Streams from R2 to YouTube in 256KB-aligned chunks
  - Parses Range header for correct offset tracking
  - Only uploads when buffer has 256KB or when final chunk ready
- `uploadVideoBytes()` - Alternative method for byte array upload
- `uploadThumbnail()` - Uploads thumbnail (max 2MB PNG)

**Thumbnail Upload:**
- Service: `src/services/youtube-upload.ts` - `uploadThumbnail()` method
- POST to `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId={id}`
- Max file size: 2MB
- Format: PNG
- Triggered automatically after successful video upload

**Upload Settings (Japanese Content):**
- Privacy: `private` (configurable, currently private for testing)
- Tags: `['日本', 'ニュース', 'Japan', 'News']`
- Category: `25` (News & Politics)
- Language: `ja` (Japanese)
- Made for Kids: `false`
- Contains Synthetic Media: `true` (AI content disclosure)
- Not Paid Content: `true` (not a paid promotion)

**Frontend Component:** `video-youtube-upload-card`
- Displays status badge (pending/uploading/processing/uploaded/error)
- Upload button when pending/error
- Progress display during upload
- YouTube link and video ID when uploaded
- Re-upload capability

**Status Transitions:**
- `pending` → `uploading` → `processing` → `uploaded` (success)
- `*` → `error` (failure at any stage)

**API Endpoints:**
- `POST /api/videos/:id/youtube-upload` - Trigger upload workflow
- `GET /api/videos/:id/youtube-upload/status` - Poll upload status

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

### E2B Sandbox
- Template: `video-renderer` (custom template with ffmpeg, curl, fonts)
- Build from `.e2b/template.ts` with `cd .e2b && bun run build.ts`
- Configuration: 8 CPU, 8GB RAM, 16GB disk for optimal video rendering
- File access: Use `sandbox.files.read()` before killing sandbox (downloadUrl requires live sandbox)

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
- Slide: headline, imageDescription, audioNarration, estimatedDuration, directorNotes?, audioProfile?
  - audioProfile: 'urgent' | 'calm' | 'excited' | 'serious' | 'casual' | 'dramatic'
  - directorNotes: TTS style/emotion/tone instructions (English)
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
- `e2b@^2.11.0` - E2B sandbox API for video rendering
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
- 010: video_selection_v2 (video_format, urgency)
- 012: youtube_upload (youtube_upload_status, youtube_info table)
