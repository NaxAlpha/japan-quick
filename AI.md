# Japan Quick

## Summary

Japan Quick is an AI-based system to generate YouTube shorts - automated short-form video content creation. The application consists of:

- **Backend**: Hono-based API running on Cloudflare Workers for video processing and AI orchestration
- **Frontend**: Lit-based web component application with TypeScript for content management and control interface

## File Tree

```
amman/
├── public/
│   └── index.html              # Main HTML entry point with app-root custom element
├── src/
│   ├── index.ts                # Cloudflare Workers backend with Hono
│   └── frontend/
│       └── app.ts              # LitElement root component (AppRoot)
├── tsconfig.json               # TypeScript config for backend (Cloudflare Workers)
├── tsconfig.frontend.json      # TypeScript config for frontend (browser)
├── wrangler.toml               # Cloudflare Workers configuration
└── package.json                # Dependencies and scripts
```

## Architecture

Japan Quick is designed as an AI-powered content generation pipeline for creating short-form videos optimized for YouTube's shorts format.

### Backend (Cloudflare Workers + Hono)

- Entry point: `/Users/nax/conductor/workspaces/japan-quick/amman/src/index.ts`
- Framework: Hono.js
- Deployment: Cloudflare Workers via Wrangler
- Static assets: Served from `public/` directory
- Core Purpose: Orchestrates AI-based video generation workflow
- Routes:
  - `GET /` - Application entry point
  - `GET /api/hello` - Health check/JSON API endpoint
  - `GET /*` - Static file serving

### Frontend (Lit + TypeScript)

- Entry point: `/Users/nax/conductor/workspaces/japan-quick/amman/public/index.html`
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
- Static file serving is handled by Hono's serveStatic middleware for Cloudflare Workers
- The project is focused on generating short-form video content (YouTube shorts format)
- Backend routes will be extended to support video generation workflows
