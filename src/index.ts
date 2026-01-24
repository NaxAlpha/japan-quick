import { Hono } from 'hono';
import { basicAuth } from './middleware/auth.js';
import { newsRoutes } from './routes/news.js';
import { articleRoutes } from './routes/articles.js';
import { videoRoutes } from './routes/videos.js';
import { frontendRoutes } from './routes/frontend.js';
import type { Env } from './types/news.js';

// Export workflow classes for Cloudflare Workers
export {
  NewsScraperWorkflow,
  ScheduledNewsRefreshWorkflow,
  ArticleScraperWorkflow,
  ArticleRescrapeWorkflow,
  VideoSelectionWorkflow
} from './workflows/index.js';

const app = new Hono<Env>();

// Frontend page routes (no auth required for UI)
app.route('/', frontendRoutes);

// Apply auth middleware to ALL API routes (including workflows)
app.use('/api/*', basicAuth());

// News/Workflow API routes (protected)
app.route('/api/news', newsRoutes);

// Article API routes (protected)
app.route('/api/articles', articleRoutes);

// Video API routes (protected)
app.route('/api/videos', videoRoutes);

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

// Export as object with fetch and scheduled handlers for Cloudflare Workers
export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Env['Bindings'], ctx: ExecutionContext) => {
    console.log('Scheduled task triggered at:', new Date(event.scheduledTime).toISOString());

    try {
      const hour = new Date(event.scheduledTime).getUTCHours();
      const minute = new Date(event.scheduledTime).getUTCMinutes();
      const isJSTBusinessHours = hour === 23 || (hour >= 0 && hour <= 11);
      const isHourMark = minute === 0;

      // Always run news workflows (hourly)
      const refreshInstance = await env.SCHEDULED_REFRESH_WORKFLOW.create({
        params: {}
      });
      console.log('Created scheduled refresh workflow:', refreshInstance.id);

      const rescrapeInstance = await env.ARTICLE_RESCRAPE_WORKFLOW.create({
        params: {}
      });
      console.log('Created article rescrape workflow:', rescrapeInstance.id);

      // Video selection: hourly during JST 8am-8pm only
      if (isJSTBusinessHours && isHourMark) {
        const videoInstance = await env.VIDEO_SELECTION_WORKFLOW.create({
          params: {}
        });
        console.log('Created video selection workflow:', videoInstance.id);
      } else {
        console.log('Skipped video selection workflow (outside JST business hours or not on the hour)');
      }
    } catch (error) {
      console.error('Failed to create scheduled workflows:', error);
    }
  }
};
