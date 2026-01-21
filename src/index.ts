import { Hono } from 'hono';
import { basicAuth } from './middleware/auth.js';
import { newsRoutes } from './routes/news.js';
import { frontendRoutes } from './routes/frontend.js';
import type { Env } from './types/news.js';

// Export workflow classes for Cloudflare Workers
export { NewsScraperWorkflow, ScheduledNewsRefreshWorkflow } from './workflows/index.js';

const app = new Hono<Env>();

// Frontend page routes (no auth required for UI)
app.route('/', frontendRoutes);

// Apply auth middleware to ALL API routes (including workflows)
app.use('/api/*', basicAuth());

// News/Workflow API routes (protected)
app.route('/api/news', newsRoutes);

// Other API routes (protected)
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

// Scheduled handler for cron triggers (runs every 15 minutes)
export const scheduled: ExportedHandlerScheduledHandler<Env['Bindings']> = async (event, env, ctx) => {
  console.log('Scheduled task triggered at:', new Date(event.scheduledTime).toISOString());

  try {
    // Create an instance of the scheduled refresh workflow
    const instance = await env.SCHEDULED_REFRESH_WORKFLOW.create({
      params: {}
    });

    console.log('Created scheduled refresh workflow:', instance.id);
  } catch (error) {
    console.error('Failed to create scheduled refresh workflow:', error);
  }
};

export default app;
