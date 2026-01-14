import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'

type Env = {
  Bindings: {}
}

const app = new Hono<Env>()

// Root route
app.get('/', (c) => {
  return c.text('Welcome to Japan Quick - AI-powered YouTube Shorts Generator')
})

// API route
app.get('/api/status', (c) => {
  return c.json({
    service: 'Japan Quick',
    description: 'AI-powered YouTube Shorts Generator',
    version: '1.0.0',
    status: 'operational'
  })
})

// Catch-all route for static files
app.get('/*', serveStatic({ root: './', manifest: {} }))

export default app
