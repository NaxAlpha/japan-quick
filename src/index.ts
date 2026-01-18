import { Hono } from 'hono'

type Env = {
  Bindings: {}
}

const app = new Hono<Env>()

// API routes
app.get('/api/status', (c) => {
  return c.json({
    service: 'Japan Quick',
    description: 'AI-powered Video Generator (Shorts & Long-form)',
    version: '1.0.0',
    status: 'operational'
  })
})

app.get('/api/hello', (c) => {
  return c.json({ message: 'Hello from Japan Quick API' })
})

export default app
