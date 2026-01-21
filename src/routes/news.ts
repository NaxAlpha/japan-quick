/**
 * News API routes - Workflow-based endpoints
 * POST /api/news/trigger - Create new workflow instance
 * GET /api/news/status/:id - Get workflow status
 * GET /api/news/result/:id - Get completed result
 * GET /api/news/latest - Get most recent D1 snapshot
 * POST /api/news/cancel/:id - Terminate workflow
 */

import { Hono } from 'hono';
import type { Env } from '../types/news.js';
import type { NewsScraperParams, NewsScraperResult } from '../workflows/types.js';

const newsRoutes = new Hono<{ Bindings: Env['Bindings'] }>();

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

// GET /api/news/latest - Get most recent D1 snapshot
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
    const newsData = JSON.parse(result.data as string);

    return c.json({
      success: true,
      snapshot: {
        id: result.id,
        capturedAt: result.captured_at,
        snapshotName: result.snapshot_name,
        data: newsData
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
