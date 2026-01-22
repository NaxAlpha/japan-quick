/**
 * Video API routes - Video selection workflow endpoints
 * GET /api/videos - List 10 most recent videos
 * GET /api/videos/:id - Get single video
 * POST /api/videos/trigger - Manual workflow trigger
 * GET /api/videos/status/:workflowId - Workflow status
 */

import { Hono } from 'hono';
import type { Env } from '../types/news.js';
import type { Video, ParsedVideo, CostLog } from '../types/video.js';
import type { VideoSelectionParams, VideoSelectionResult } from '../workflows/video-selection.workflow.js';
import { parseVideo } from '../types/video.js';

const videoRoutes = new Hono<{ Bindings: Env['Bindings'] }>();

// GET /api/videos - List 10 most recent videos
videoRoutes.get('/', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT * FROM videos
      ORDER BY created_at DESC
      LIMIT 10
    `).all();

    const videos = (result.results as Video[]).map(parseVideo);

    return c.json({
      success: true,
      videos
    });
  } catch (error) {
    console.error('Failed to fetch videos:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch videos'
    }, 500);
  }
});

// GET /api/videos/:id - Get single video with cost logs
videoRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    // Fetch video
    const video = await c.env.DB.prepare(`
      SELECT * FROM videos WHERE id = ?
    `).bind(id).first<Video>();

    if (!video) {
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
    console.error('Failed to fetch video:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch video'
    }, 500);
  }
});

// POST /api/videos/trigger - Manual workflow trigger
videoRoutes.post('/trigger', async (c) => {
  try {
    const params: VideoSelectionParams = {};

    // Create workflow instance
    const instance = await c.env.VIDEO_SELECTION_WORKFLOW.create({
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

// GET /api/videos/status/:workflowId - Workflow status
videoRoutes.get('/status/:workflowId', async (c) => {
  try {
    const workflowId = c.req.param('workflowId');
    const instance = await c.env.VIDEO_SELECTION_WORKFLOW.get(workflowId);

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

export { videoRoutes };
