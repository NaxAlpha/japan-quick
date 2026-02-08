/**
 * News API routes - Workflow-based endpoints
 * POST /api/news/trigger - Create new workflow instance
 * POST /api/news/trigger-refresh - Manually trigger scheduled refresh workflow
 * POST /api/news/trigger-rescrape - Manually trigger article rescrape workflow
 * GET /api/news/status/:id - Get workflow status
 * GET /api/news/result/:id - Get completed result
 * GET /api/news/latest - Get most recent D1 snapshot with article status
 * POST /api/news/cancel/:id - Terminate workflow
 */

import { Hono } from 'hono';
import type { Env } from '../types/env.js';
import type { YahooNewsTopPick, YahooNewsResponse } from '../types/news.js';
import type { NewsScraperParams, NewsScraperResult } from '../workflows/types.js';
import type { ArticleStatus } from '../types/article.js';
import { log, generateRequestId } from '../lib/logger.js';
import { successResponse, errorResponse, notFoundResponse } from '../lib/api-response.js';
import { runRoute } from '../lib/route-helpers.js';

const newsRoutes = new Hono<{ Bindings: Env['Bindings'] }>();

// Helper to extract pickId from a pickup URL
function extractPickId(url: string): string | null {
  const match = url.match(/\/pickup\/(\d+)$/);
  return match ? match[1] : null;
}

// POST /api/news/trigger - Create new workflow instance
newsRoutes.post('/trigger', async (c) => {
  const reqId = generateRequestId();
  return runRoute(log.newsRoutes, reqId, { method: 'POST', path: '/trigger' }, async () => {
    const body = await c.req.json<NewsScraperParams>().catch(() => ({}));
    const params: NewsScraperParams = {
      skipCache: body.skipCache ?? false
    };

    // Create workflow instance
    const instance = await c.env.NEWS_SCRAPER_WORKFLOW.create({
      params
    });

    log.newsRoutes.info(reqId, 'Workflow created', { workflowId: instance.id });
    return successResponse({ workflowId: instance.id });
  });
});

// POST /api/news/trigger-refresh - Manually trigger scheduled refresh workflow
newsRoutes.post('/trigger-refresh', async (c) => {
  const reqId = generateRequestId();
  return runRoute(log.newsRoutes, reqId, { method: 'POST', path: '/trigger-refresh' }, async () => {
    const instance = await c.env.SCHEDULED_REFRESH_WORKFLOW.create({
      params: {}
    });

    log.newsRoutes.info(reqId, 'Workflow created', { workflowId: instance.id });
    return successResponse({ workflowId: instance.id });
  });
});

// POST /api/news/trigger-rescrape - Manually trigger article rescrape workflow
newsRoutes.post('/trigger-rescrape', async (c) => {
  const reqId = generateRequestId();
  return runRoute(log.newsRoutes, reqId, { method: 'POST', path: '/trigger-rescrape' }, async () => {
    const instance = await c.env.ARTICLE_RESCRAPE_WORKFLOW.create({
      params: {}
    });

    log.newsRoutes.info(reqId, 'Workflow created', { workflowId: instance.id });
    return successResponse({ workflowId: instance.id });
  });
});

// GET /api/news/status/:id - Get workflow status
newsRoutes.get('/status/:id', async (c) => {
  const reqId = generateRequestId();
  const id = c.req.param('id');
  return runRoute(log.newsRoutes, reqId, { method: 'GET', path: `/status/${id}` }, async () => {
    const workflowId = id;
    const instance = await c.env.NEWS_SCRAPER_WORKFLOW.get(workflowId);

    if (!instance) {
      log.newsRoutes.warn(reqId, 'Workflow not found', { workflowId });
      return notFoundResponse('Workflow');
    }

    const status = await instance.status();

    return successResponse({
      workflowId: instance.id,
      status: status.status,
      output: status.output
    });
  });
});

// GET /api/news/result/:id - Get completed result
newsRoutes.get('/result/:id', async (c) => {
  const reqId = generateRequestId();
  const id = c.req.param('id');
  return runRoute(log.newsRoutes, reqId, { method: 'GET', path: `/result/${id}` }, async () => {
    const workflowId = id;
    const instance = await c.env.NEWS_SCRAPER_WORKFLOW.get(workflowId);

    if (!instance) {
      log.newsRoutes.warn(reqId, 'Workflow not found', { workflowId });
      return notFoundResponse('Workflow');
    }

    const status = await instance.status();

    if (status.status !== 'complete') {
      log.newsRoutes.warn(reqId, 'Workflow not yet complete', { workflowId, status: status.status });
      return errorResponse('Workflow not yet complete', 400);
    }

    const result = status.output as NewsScraperResult;

    // Augment result with article status (same pattern as /api/news/latest)
    if (result.success && result.data?.topPicks) {
      const pickIds = result.data.topPicks
        .map(pick => extractPickId(pick.url))
        .filter((id): id is string => id !== null);

      const statusMap = new Map<string, ArticleStatus>();

      if (pickIds.length > 0) {
        const placeholders = pickIds.map(() => '?').join(', ');
        const articlesResult = await c.env.DB.prepare(
          `SELECT pick_id, status FROM articles WHERE pick_id IN (${placeholders})`
        ).bind(...pickIds).all();

        for (const row of articlesResult.results) {
          const r = row as { pick_id: string; status: string };
          statusMap.set(r.pick_id, r.status as ArticleStatus);
        }
      }

      // Augment topPicks with pickId and articleStatus
      result.data.topPicks = result.data.topPicks.map(pick => {
        const pickId = extractPickId(pick.url);
        return {
          ...pick,
          pickId: pickId || undefined,
          articleStatus: pickId ? statusMap.get(pickId) : undefined
        };
      });
    }

    return successResponse({ result });
  });
});

// GET /api/news/latest - Get most recent D1 snapshot with article status
newsRoutes.get('/latest', async (c) => {
  const reqId = generateRequestId();
  return runRoute(log.newsRoutes, reqId, { method: 'GET', path: '/latest' }, async () => {
    const result = await c.env.DB.prepare(
      'SELECT * FROM news_snapshots ORDER BY id DESC LIMIT 1'
    ).first();

    if (!result) {
      log.newsRoutes.warn(reqId, 'No snapshots found');
      return notFoundResponse('News snapshots');
    }

    // Parse the JSON data field
    const newsData = JSON.parse(result.data as string) as YahooNewsResponse;

    // Extract pickIds from news items and get their article statuses
    const pickIds = newsData.topPicks
      .map(pick => extractPickId(pick.url))
      .filter((id): id is string => id !== null);

    // Build a map of pickId -> status
    const statusMap = new Map<string, ArticleStatus>();

    if (pickIds.length > 0) {
      try {
        const placeholders = pickIds.map(() => '?').join(', ');
        const articlesResult = await c.env.DB.prepare(
          `SELECT pick_id, status FROM articles WHERE pick_id IN (${placeholders})`
        ).bind(...pickIds).all();

        for (const row of articlesResult.results) {
          const r = row as { pick_id: string; status: string };
          statusMap.set(r.pick_id, r.status as ArticleStatus);
        }
      } catch (error) {
        log.newsRoutes.error(reqId, 'Failed to fetch article statuses', error as Error);
        // Continue without statuses
      }
    }

    // Augment topPicks with pickId and articleStatus
    const augmentedTopPicks: YahooNewsTopPick[] = newsData.topPicks.map(pick => {
      const pickId = extractPickId(pick.url);
      return {
        ...pick,
        pickId: pickId || undefined,
        articleStatus: pickId ? statusMap.get(pickId) : undefined
      };
    });

    return successResponse({
      snapshot: {
        id: result.id,
        capturedAt: result.captured_at,
        snapshotName: result.snapshot_name,
        data: {
          ...newsData,
          topPicks: augmentedTopPicks
        }
      }
    });
  });
});

// POST /api/news/cancel/:id - Terminate workflow
newsRoutes.post('/cancel/:id', async (c) => {
  const reqId = generateRequestId();
  const id = c.req.param('id');
  return runRoute(log.newsRoutes, reqId, { method: 'POST', path: `/cancel/${id}` }, async () => {
    const workflowId = id;
    const instance = await c.env.NEWS_SCRAPER_WORKFLOW.get(workflowId);

    if (!instance) {
      log.newsRoutes.warn(reqId, 'Workflow not found', { workflowId });
      return notFoundResponse('Workflow');
    }

    await instance.terminate();
    log.newsRoutes.info(reqId, 'Workflow terminated', { workflowId });

    return successResponse({ message: 'Workflow terminated' });
  });
});

export { newsRoutes };
