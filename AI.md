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
│   ├── index.ts                # Cloudflare Workers backend with Hono
│   ├── middleware/
│   │   └── auth.ts             # Basic HTTP authentication middleware
│   └── frontend/
│       └── app.ts              # LitElement root component (AppRoot)
├── tsconfig.json               # TypeScript config for backend (Cloudflare Workers)
├── tsconfig.frontend.json      # TypeScript config for frontend (browser)
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
- **Authentication**: Basic HTTP Auth protecting all routes
- Routes:
  - `GET /` - Application entry point (protected)
  - `GET /api/hello` - Health check/JSON API endpoint (protected)
  - `GET /api/status` - Service status endpoint (protected)

### Frontend (Lit + TypeScript)

- Entry point: `public/index.html`
- Framework: Lit (Web Components)
- Component: `<app-root>` custom element defined in `src/frontend/app.ts`
- Build output: `public/frontend/app.js` (from TypeScript compilation)
- Styling: Scoped CSS within Lit components
- Purpose: Provides interface for content generation, preview, and management

## Development Commands

```bash
# Install dependencies
bun install

# Build frontend TypeScript to JavaScript
bun run build:frontend

# Start local development server (Wrangler)
bun run dev

# Deploy to Cloudflare Workers
bun run deploy
```

## Authentication

The application uses **Basic HTTP Authentication** to protect all routes.

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
- **All routes protected**: `app.use('*', basicAuth())` in `src/index.ts`
- **Browser-native**: Login prompt shown by browser automatically
- **Stateless**: No sessions or tokens, credentials validated on each request

### Testing Auth

```bash
# Without auth (should return 401)
curl -i https://your-worker.workers.dev/api/hello

# With valid auth
curl -u admin:password https://your-worker.workers.dev/api/hello
```

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
- **AI Integration**: Backend designed to integrate with AI models for video content generation

### Important Notes

- The frontend requires building before deployment: `bun run build:frontend`
- Lit uses decorators (experimentalDecorators: true in tsconfig)
- The `useDefineForClassFields: false` setting is required for Lit to work correctly with TypeScript
- Static file serving is handled by Wrangler's `[assets]` configuration in wrangler.toml, NOT by Hono middleware
- Do NOT use `serveStatic` from `hono/cloudflare-workers` - it causes `__STATIC_CONTENT is not defined` errors in local dev
- The project generates both short-form (YouTube Shorts) and long-form video content
- Backend routes will be extended to support video generation workflows
- **All routes are protected by Basic HTTP Auth** - credentials stored in `wrangler.toml` `[vars]`
- **Note**: Credentials in `wrangler.toml` are visible to anyone with repo access
