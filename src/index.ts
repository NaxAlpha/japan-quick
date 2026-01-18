import { Hono } from 'hono'
import { basicAuth } from './middleware/auth'

type Env = {
  Bindings: {
    ADMIN_USERNAME: string
    ADMIN_PASSWORD: string
  }
}

const app = new Hono<Env>()

// Apply auth middleware to ALL routes
app.use('*', basicAuth())

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
