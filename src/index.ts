import { Hono } from 'hono';
import { jwtAuth } from './middleware/jwt-auth.js';
import { authRoutes } from './routes/auth.js';
import { newsRoutes } from './routes/news.js';
import { articleRoutes } from './routes/articles.js';
import { videoRoutes } from './routes/videos.js';
import youtubeRoutes from './routes/youtube.js';
import { frontendRoutes } from './routes/frontend.js';
import { renderPageTemplate } from './lib/html-template.js';
import { evaluateVideoSelectionTrigger } from './lib/video-selection-policy.js';
import type { Env } from './types/env.js';
import { log } from './lib/logger.js';

// Export workflow classes for Cloudflare Workers
export {
  NewsScraperWorkflow,
  ScheduledNewsRefreshWorkflow,
  ArticleScraperWorkflow,
  ArticleRescrapeWorkflow,
  VideoSelectionWorkflow,
  VideoRenderWorkflow,
  ScriptGenerationWorkflow,
  AssetGenerationWorkflow,
  YouTubeUploadWorkflow,
  TestChunkedWorkflow
} from './workflows/index.js';

const app = new Hono<Env>();

// Frontend page routes (public - 401 handling via fetch-init.js)
app.route('/', frontendRoutes);

// Log app initialization
log.app.info('Japan Quick API initialized', { version: '1.0.0' });

// Auth routes (public - register before auth middleware)
app.route('/api/auth', authRoutes);

// Apply JWT auth middleware to ALL API routes
// /api/auth routes are public (registered above, excluded by middleware)
// Frontend pages are public - 401 handling done via fetch-init.js
app.use('/api/*', jwtAuth());

// News/Workflow API routes (protected by /api/* middleware)
app.route('/api/news', newsRoutes);

// Article API routes (protected by /api/* middleware)
app.route('/api/articles', articleRoutes);

// Video API routes (protected by /api/* middleware)
app.route('/api/videos', videoRoutes);

// YouTube API routes (protected by /api/* middleware)
app.route('/api/youtube', youtubeRoutes);

// Settings page (public - API calls protected by /api/* middleware)
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
    const scheduledDate = new Date(event.scheduledTime);
    const scheduledTime = scheduledDate.toISOString();
    const triggerDecision = evaluateVideoSelectionTrigger(scheduledDate);
    log.app.info('Scheduled handler invoked', {
      scheduledTime,
      utcHour: triggerDecision.utcHour,
      utcMinute: triggerDecision.utcMinute,
      jstHour: triggerDecision.jstHour,
      jstMinute: triggerDecision.jstMinute,
      isOddJstHour: triggerDecision.isOddJstHour,
      isHourMark: triggerDecision.isHourMark,
      shouldTriggerVideoSelection: triggerDecision.shouldTrigger
    });

    try {
      // Always run news workflows (hourly)
      const refreshInstance = await env.SCHEDULED_REFRESH_WORKFLOW.create({
        params: {}
      });
      log.app.info('Created scheduled refresh workflow', { workflowId: refreshInstance.id });

      const rescrapeInstance = await env.ARTICLE_RESCRAPE_WORKFLOW.create({
        params: {}
      });
      log.app.info('Created article rescrape workflow', { workflowId: rescrapeInstance.id });

      // Video selection: odd JST hours only (1, 3, ..., 23) on minute 00
      if (triggerDecision.shouldTrigger) {
        const videoInstance = await env.VIDEO_SELECTION_WORKFLOW.create({
          params: {}
        });
        log.app.info('Created video selection workflow', { workflowId: videoInstance.id });
      } else {
        log.app.info('Skipped video selection workflow', {
          reason: 'not odd JST hour at minute 00',
          utcHour: triggerDecision.utcHour,
          utcMinute: triggerDecision.utcMinute,
          jstHour: triggerDecision.jstHour,
          jstMinute: triggerDecision.jstMinute,
          isOddJstHour: triggerDecision.isOddJstHour,
          isHourMark: triggerDecision.isHourMark
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.app.error('Failed to create scheduled workflows', { error: message });
    }
  }
};
