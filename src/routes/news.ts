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
import type { Env, YahooNewsTopPick, YahooNewsResponse } from '../types/news.js';
import type { NewsScraperParams, NewsScraperResult } from '../workflows/types.js';
import type { ArticleStatus } from '../types/article.js';

const newsRoutes = new Hono<{ Bindings: Env['Bindings'] }>();

// Helper to extract pickId from a pickup URL
function extractPickId(url: string): string | null {
  const match = url.match(/\/pickup\/(\d+)$/);
  return match ? match[1] : null;
}

// POST /api/news/trigger - Create new workflow instance
newsRoutes.post('/trigger', async (c) => {
  try {
    const body = await c.req.json<NewsScraperParams>().catch(() => ({}));
    const params: NewsScraperParams = {
      skipCache: body.skipCache ?? false
    };

    // Create workflow instance
    const instance = await c.env.NEWS_SCRAPER_WORKFLOW.create({
      params
    });

    return c.json({
      success: true,
      workflowId: instance.id
    });
  } catch (error) {
    console.error('Failed to create workflow:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create workflow'
    }, 500);
  }
});

// POST /api/news/trigger-refresh - Manually trigger scheduled refresh workflow
newsRoutes.post('/trigger-refresh', async (c) => {
  try {
    const instance = await c.env.SCHEDULED_REFRESH_WORKFLOW.create({
      params: {}
    });

    return c.json({
      success: true,
      workflowId: instance.id
    });
  } catch (error) {
    console.error('Failed to create scheduled refresh workflow:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create scheduled refresh workflow'
    }, 500);
  }
});

// POST /api/news/trigger-rescrape - Manually trigger article rescrape workflow
newsRoutes.post('/trigger-rescrape', async (c) => {
  try {
    const instance = await c.env.ARTICLE_RESCRAPE_WORKFLOW.create({
      params: {}
    });

    return c.json({
      success: true,
      workflowId: instance.id
    });
  } catch (error) {
    console.error('Failed to create article rescrape workflow:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create article rescrape workflow'
    }, 500);
  }
});

// GET /api/news/status/:id - Get workflow status
newsRoutes.get('/status/:id', async (c) => {
  try {
    const workflowId = c.req.param('id');
    const instance = await c.env.NEWS_SCRAPER_WORKFLOW.get(workflowId);

    if (!instance) {
      return c.json({
        success: false,
        error: 'Workflow not found'
      }, 404);
    }

    const status = await instance.status();

    return c.json({
      success: true,
      workflowId: instance.id,
      status: status.status,
      output: status.output
    });
  } catch (error) {
    console.error('Failed to get workflow status:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get workflow status'
    }, 500);
  }
});

// GET /api/news/result/:id - Get completed result
newsRoutes.get('/result/:id', async (c) => {
  try {
    const workflowId = c.req.param('id');
    const instance = await c.env.NEWS_SCRAPER_WORKFLOW.get(workflowId);

    if (!instance) {
      return c.json({
        success: false,
        error: 'Workflow not found'
      }, 404);
    }

    const status = await instance.status();

    if (status.status !== 'complete') {
      return c.json({
        success: false,
        error: 'Workflow not yet complete',
        status: status.status
      }, 400);
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

    return c.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Failed to get workflow result:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get workflow result'
    }, 500);
  }
});

// GET /api/news/latest - Get most recent D1 snapshot with article status
newsRoutes.get('/latest', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT * FROM news_snapshots ORDER BY id DESC LIMIT 1'
    ).first();

    if (!result) {
      return c.json({
        success: false,
        error: 'No snapshots found'
      }, 404);
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
        console.error('Failed to fetch article statuses:', error);
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

    return c.json({
      success: true,
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
  } catch (error) {
    console.error('Failed to get latest snapshot:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get latest snapshot'
    }, 500);
  }
});

// POST /api/news/cancel/:id - Terminate workflow
newsRoutes.post('/cancel/:id', async (c) => {
  try {
    const workflowId = c.req.param('id');
    const instance = await c.env.NEWS_SCRAPER_WORKFLOW.get(workflowId);

    if (!instance) {
      return c.json({
        success: false,
        error: 'Workflow not found'
      }, 404);
    }

    await instance.terminate();

    return c.json({
      success: true,
      message: 'Workflow terminated'
    });
  } catch (error) {
    console.error('Failed to terminate workflow:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to terminate workflow'
    }, 500);
  }
});

export { newsRoutes };
