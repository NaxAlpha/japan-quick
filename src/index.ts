import { Hono } from 'hono';
import { basicAuth } from './middleware/auth.js';
import { newsRoutes } from './routes/news.js';
import { frontendRoutes } from './routes/frontend.js';
import type { Env } from './types/news.js';

const app = new Hono<Env>();

// Frontend page routes (no auth required for UI)
app.route('/', frontendRoutes);

// News API routes (public - news data is from public sources)
app.route('/api/news', newsRoutes);

// Apply auth middleware to other API routes
app.use('/api/*', basicAuth());

// API routes (protected)
app.get('/api/status', (c) => {
  return c.json({
    service: 'Japan Quick',
    description: 'AI-powered Video Generator (Shorts & Long-form)',
    version: '1.0.0',
    status: 'operational'
  });
});

app.get('/api/hello', (c) => {
  return c.json({ message: 'Hello from Japan Quick API' });
});

export default app;
