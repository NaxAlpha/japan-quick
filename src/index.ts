import { Hono } from 'hono';
import { basicAuth } from './middleware/auth.js';
import { newsRoutes } from './routes/news.js';
import { articleRoutes } from './routes/articles.js';
import { videoRoutes } from './routes/videos.js';
import youtubeRoutes from './routes/youtube.js';
import { frontendRoutes } from './routes/frontend.js';
import { renderPageTemplate } from './lib/html-template.js';
import type { Env } from './types/news.js';
import { log } from './lib/logger.js';
import { Sandbox } from '@cloudflare/sandbox';

// Export workflow classes for Cloudflare Workers
export {
  NewsScraperWorkflow,
  ScheduledNewsRefreshWorkflow,
  ArticleScraperWorkflow,
  ArticleRescrapeWorkflow,
  VideoSelectionWorkflow,
  VideoRenderWorkflow,
  ScriptGenerationWorkflow,
  AssetGenerationWorkflow
} from './workflows/index.js';

// Export Sandbox class for Cloudflare Workers (SQLite DO for containers)
export { Sandbox };

const app = new Hono<Env>();

// Frontend page routes (no auth required for UI)
app.route('/', frontendRoutes);

// Log app initialization
log.app.info('Japan Quick API initialized', { version: '1.0.0' });

// Apply auth middleware to ALL API routes (including workflows)
app.use('/api/*', basicAuth());

// Apply auth middleware to settings page
app.use('/settings', basicAuth());

// News/Workflow API routes (protected)
app.route('/api/news', newsRoutes);

// Article API routes (protected)
app.route('/api/articles', articleRoutes);

// Video API routes (protected)
app.route('/api/videos', videoRoutes);

// YouTube API routes (protected)
app.route('/api/youtube', youtubeRoutes);

// Settings page (protected)
app.get('/settings', (c) => {
  const html = renderPageTemplate({
    title: 'Settings - Japan Quick',
    description: 'Application Settings',
    componentName: 'settings-page',
    scriptPath: '/frontend/pages/settings-page.js'
  });
  return c.html(html);
});

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
    const scheduledTime = new Date(event.scheduledTime).toISOString();
    log.app.info('Scheduled handler invoked', { scheduledTime });

    try {
      const hour = new Date(event.scheduledTime).getUTCHours();
      const minute = new Date(event.scheduledTime).getUTCMinutes();
      const isJSTBusinessHours = hour === 23 || (hour >= 0 && hour <= 11);
      const isHourMark = minute === 0;

      // Always run news workflows (hourly)
      const refreshInstance = await env.SCHEDULED_REFRESH_WORKFLOW.create({
        params: {}
      });
      log.app.info('Created scheduled refresh workflow', { workflowId: refreshInstance.id });

      const rescrapeInstance = await env.ARTICLE_RESCRAPE_WORKFLOW.create({
        params: {}
      });
      log.app.info('Created article rescrape workflow', { workflowId: rescrapeInstance.id });

      // Video selection: hourly during JST 8am-8pm only
      if (isJSTBusinessHours && isHourMark) {
        const videoInstance = await env.VIDEO_SELECTION_WORKFLOW.create({
          params: {}
        });
        log.app.info('Created video selection workflow', { workflowId: videoInstance.id });
      } else {
        log.app.info('Skipped video selection workflow', {
          reason: 'outside JST business hours or not on the hour',
          isJSTBusinessHours,
          isHourMark
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.app.error('Failed to create scheduled workflows', { error: message });
    }
  }
};
