/**
 * Video API routes - Video selection workflow endpoints
 * GET /api/videos - List 10 most recent videos (supports ?page=N)
 * GET /api/videos/:id - Get single video
 * DELETE /api/videos/:id - Delete video and cost logs
 * POST /api/videos/trigger - Manual workflow trigger
 * GET /api/videos/status/:workflowId - Workflow status
 */

import { Hono } from 'hono';
import type { Env } from '../types/news.js';
import type { Video, ParsedVideo, CostLog } from '../types/video.js';
import type { VideoSelectionParams, VideoSelectionResult } from '../workflows/video-selection.workflow.js';
import { parseVideo } from '../types/video.js';
import { log, generateRequestId } from '../lib/logger.js';

const videoRoutes = new Hono<{ Bindings: Env['Bindings'] }>();

// GET /api/videos - List 10 most recent videos with pagination
videoRoutes.get('/', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  const page = parseInt(c.req.query('page') || '1');
  log.videoRoutes.info(reqId, 'Request received', { method: 'GET', path: '/', page });

  try {
    const limit = 10;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM videos
    `).first<{ count: number }>();

    const total = countResult?.count || 0;

    // Get paginated videos
    const result = await c.env.DB.prepare(`
      SELECT * FROM videos
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    const videos = (result.results as Video[]).map(parseVideo);

    const hasMore = offset + videos.length < total;

    return c.json({
      success: true,
      videos,
      pagination: {
        page,
        limit,
        total,
        hasMore
      }
    });
  } catch (error) {
    log.videoRoutes.error(reqId, 'Request failed', error as Error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch videos'
    }, 500);
  } finally {
    const durationMs = Date.now() - startTime;
    log.videoRoutes.info(reqId, 'Request completed', { status: 200, durationMs });
  }
});

// GET /api/videos/:id - Get single video with cost logs
videoRoutes.get('/:id', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  const id = c.req.param('id');
  log.videoRoutes.info(reqId, 'Request received', { method: 'GET', path: `/:id`, id });

  try {
    // Fetch video
    const video = await c.env.DB.prepare(`
      SELECT * FROM videos WHERE id = ?
    `).bind(id).first<Video>();

    if (!video) {
      log.videoRoutes.warn(reqId, 'Video not found', { id });
      return c.json({
        success: false,
        error: 'Video not found'
      }, 404);
    }

    // Fetch cost logs
    const costLogsResult = await c.env.DB.prepare(`
      SELECT * FROM cost_logs WHERE video_id = ? ORDER BY created_at ASC
    `).bind(id).all();

    const costLogs = costLogsResult.results as CostLog[];

    return c.json({
      success: true,
      video: parseVideo(video),
      costLogs
    });
  } catch (error) {
    log.videoRoutes.error(reqId, 'Request failed', error as Error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch video'
    }, 500);
  } finally {
    const durationMs = Date.now() - startTime;
    log.videoRoutes.info(reqId, 'Request completed', { status: 200, durationMs });
  }
});

// DELETE /api/videos/:id - Delete video and its cost logs
videoRoutes.delete('/:id', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  const id = c.req.param('id');
  log.videoRoutes.info(reqId, 'Request received', { method: 'DELETE', path: `/:id`, id });

  try {
    // Check if video exists
    const video = await c.env.DB.prepare(`
      SELECT id FROM videos WHERE id = ?
    `).bind(id).first();

    if (!video) {
      log.videoRoutes.warn(reqId, 'Video not found', { id });
      return c.json({
        success: false,
        error: 'Video not found'
      }, 404);
    }

    // Delete cost_logs first (foreign key constraint)
    await c.env.DB.prepare(`
      DELETE FROM cost_logs WHERE video_id = ?
    `).bind(id).run();

    // Delete the video
    await c.env.DB.prepare(`
      DELETE FROM videos WHERE id = ?
    `).bind(id).run();

    log.videoRoutes.info(reqId, 'Video deleted', { id });

    return c.json({
      success: true,
      message: 'Video deleted successfully'
    });
  } catch (error) {
    log.videoRoutes.error(reqId, 'Request failed', error as Error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete video'
    }, 500);
  } finally {
    const durationMs = Date.now() - startTime;
    log.videoRoutes.info(reqId, 'Request completed', { status: 200, durationMs });
  }
});

// POST /api/videos/trigger - Manual workflow trigger
videoRoutes.post('/trigger', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  log.videoRoutes.info(reqId, 'Request received', { method: 'POST', path: '/trigger' });

  try {
    const params: VideoSelectionParams = {};

    // Create workflow instance
    const instance = await c.env.VIDEO_SELECTION_WORKFLOW.create({
      params
    });

    log.videoRoutes.info(reqId, 'Workflow created', { workflowId: instance.id });
    return c.json({
      success: true,
      workflowId: instance.id
    });
  } catch (error) {
    log.videoRoutes.error(reqId, 'Request failed', error as Error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create workflow'
    }, 500);
  } finally {
    const durationMs = Date.now() - startTime;
    log.videoRoutes.info(reqId, 'Request completed', { status: 200, durationMs });
  }
});

// GET /api/videos/status/:workflowId - Workflow status
videoRoutes.get('/status/:workflowId', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  const workflowId = c.req.param('workflowId');
  log.videoRoutes.info(reqId, 'Request received', { method: 'GET', path: `/status/${workflowId}` });

  try {
    const instance = await c.env.VIDEO_SELECTION_WORKFLOW.get(workflowId);

    if (!instance) {
      log.videoRoutes.warn(reqId, 'Workflow not found', { workflowId });
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
    log.videoRoutes.error(reqId, 'Request failed', error as Error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get workflow status'
    }, 500);
  } finally {
    const durationMs = Date.now() - startTime;
    log.videoRoutes.info(reqId, 'Request completed', { status: 200, durationMs });
  }
});

export { videoRoutes };
