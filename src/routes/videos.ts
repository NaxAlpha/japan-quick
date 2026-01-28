/**
 * Video API routes - Video selection workflow endpoints
 * GET /api/videos - List 10 most recent videos (supports ?page=N)
 * GET /api/videos/:id - Get single video with assets
 * DELETE /api/videos/:id - Delete video and cost logs
 * POST /api/videos/:id/generate-script - Trigger script generation workflow
 * POST /api/videos/:id/generate-assets - Trigger asset generation workflow
 * GET /api/videos/:id/script/status - Get script generation status
 * GET /api/videos/:id/assets/status - Get asset generation status
 * GET /api/videos/:id/assets/:assetId - Serve asset from R2
 * POST /api/videos/trigger - Manual workflow trigger
 * GET /api/videos/status/:workflowId - Workflow status
 * POST /api/videos/:id/render - Trigger video render workflow
 * GET /api/videos/:id/render/status - Poll render status
 */

import { Hono } from 'hono';
import type { Env } from '../types/news.js';
import type { Video, ParsedVideo, CostLog, VideoAsset, ParsedVideoAsset, VideoScript, TTS_VOICES } from '../types/video.js';
import type { VideoSelectionParams, VideoSelectionResult } from '../workflows/video-selection.workflow.js';
import type { VideoRenderParams, VideoRenderResult } from '../workflows/video-render.workflow.js';
import type { ScriptGenerationParams, ScriptGenerationResult } from '../workflows/script-generation.workflow.js';
import type { AssetGenerationParams, AssetGenerationResult } from '../workflows/asset-generation.workflow.js';
import type { Article, ArticleVersion, ArticleComment } from '../types/article.js';
import { parseVideo, TTS_VOICES as TTSVoicesArray } from '../types/video.js';
import { R2StorageService } from '../services/r2-storage.js';
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

// GET /api/videos/:id - Get single video with cost logs and assets
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

    // Fetch video assets
    const assetsResult = await c.env.DB.prepare(`
      SELECT * FROM video_assets WHERE video_id = ? ORDER BY asset_type, asset_index
    `).bind(id).all();

    // Use direct R2 public URLs for browser <img> and <audio> tags
    const assets: ParsedVideoAsset[] = (assetsResult.results as VideoAsset[]).map(asset => ({
      id: asset.id,
      assetType: asset.asset_type,
      assetIndex: asset.asset_index,
      url: `${c.env.ASSETS_PUBLIC_URL}/${asset.r2_key}`,
      mimeType: asset.mime_type,
      fileSize: asset.file_size,
      metadata: asset.metadata ? JSON.parse(asset.metadata) : null
    }));

    const parsedVideo = parseVideo(video);

    return c.json({
      success: true,
      video: { ...parsedVideo, assets },
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

// POST /api/videos/:id/generate-script - Trigger script generation workflow
videoRoutes.post('/:id/generate-script', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  const id = c.req.param('id');
  log.videoRoutes.info(reqId, 'Request received', { method: 'POST', path: `/:id/generate-script`, id });

  try {
    // 1. Validate video exists and can generate
    const video = await c.env.DB.prepare(`
      SELECT script_status FROM videos WHERE id = ?
    `).bind(id).first<{ script_status: string }>();

    if (!video) {
      log.videoRoutes.warn(reqId, 'Video not found', { id });
      return c.json({
        success: false,
        error: 'Video not found'
      }, 404);
    }

    if (video.script_status === 'generating') {
      log.videoRoutes.warn(reqId, 'Script generation already in progress', { id });
      return c.json({
        success: false,
        error: 'Script generation already in progress'
      }, 400);
    }

    // 2. Trigger ScriptGenerationWorkflow
    const params: ScriptGenerationParams = { videoId: parseInt(id) };

    const instance = await c.env.SCRIPT_GENERATION_WORKFLOW.create({
      id: `script-gen-${id}-${Date.now()}`,
      params
    });

    log.videoRoutes.info(reqId, 'Workflow created', { workflowId: instance.id, videoId: id });

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
    log.videoRoutes.info(reqId, 'Request completed', { durationMs });
  }
});

// GET /api/videos/:id/script/status - Get script generation status
videoRoutes.get('/:id/script/status', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  const id = c.req.param('id');
  log.videoRoutes.info(reqId, 'Request received', { method: 'GET', path: `/:id/script/status`, id });

  try {
    const video = await c.env.DB.prepare(`
      SELECT script_status, script_error, script
      FROM videos WHERE id = ?
    `).bind(id).first<{
      script_status: string;
      script_error: string | null;
      script: string | null;
    }>();

    if (!video) {
      log.videoRoutes.warn(reqId, 'Video not found', { id });
      return c.json({
        success: false,
        error: 'Video not found'
      }, 404);
    }

    // Check for stale 'generating' status (> 10 minutes)
    if (video.script_status === 'generating') {
      const updatedResult = await c.env.DB.prepare(`
        SELECT updated_at FROM videos WHERE id = ?
      `).bind(id).first<{ updated_at: string }>();

      if (updatedResult) {
        const updatedAt = new Date(updatedResult.updated_at);
        const staleThreshold = 10 * 60 * 1000; // 10 minutes
        const now = new Date();

        if (now.getTime() - updatedAt.getTime() > staleThreshold) {
          // Auto-reset stale status
          await c.env.DB.prepare(`
            UPDATE videos
            SET script_status = 'pending', script_error = 'Generation timed out (stale status)', updated_at = datetime('now')
            WHERE id = ?
          `).bind(id).run();

          video.script_status = 'pending';
          video.script_error = 'Generation timed out (stale status)';
        }
      }
    }

    return c.json({
      success: true,
      status: video.script_status,
      error: video.script_error,
      hasScript: !!video.script
    });
  } catch (error) {
    log.videoRoutes.error(reqId, 'Request failed', error as Error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get script status'
    }, 500);
  } finally {
    const durationMs = Date.now() - startTime;
    log.videoRoutes.info(reqId, 'Request completed', { durationMs });
  }
});

// POST /api/videos/:id/generate-assets - Trigger asset generation workflow
videoRoutes.post('/:id/generate-assets', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  const id = c.req.param('id');
  log.videoRoutes.info(reqId, 'Request received', { method: 'POST', path: `/:id/generate-assets`, id });

  try {
    // 1. Validate video exists and can generate
    const video = await c.env.DB.prepare(`
      SELECT script_status, asset_status FROM videos WHERE id = ?
    `).bind(id).first<{ script_status: string; asset_status: string }>();

    if (!video) {
      log.videoRoutes.warn(reqId, 'Video not found', { id });
      return c.json({
        success: false,
        error: 'Video not found'
      }, 404);
    }

    if (video.script_status !== 'generated') {
      log.videoRoutes.warn(reqId, 'Script not generated yet', { id, scriptStatus: video.script_status });
      return c.json({
        success: false,
        error: 'Script not generated yet'
      }, 400);
    }

    if (video.asset_status === 'generating') {
      log.videoRoutes.warn(reqId, 'Asset generation already in progress', { id });
      return c.json({
        success: false,
        error: 'Asset generation in progress'
      }, 409);
    }

    // 2. Trigger AssetGenerationWorkflow
    const params: AssetGenerationParams = { videoId: parseInt(id) };

    const instance = await c.env.ASSET_GENERATION_WORKFLOW.create({
      id: `asset-gen-${id}-${Date.now()}`,
      params
    });

    log.videoRoutes.info(reqId, 'Workflow created', { workflowId: instance.id, videoId: id });

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
    log.videoRoutes.info(reqId, 'Request completed', { durationMs });
  }
});

// GET /api/videos/:id/assets/status - Get asset generation status
videoRoutes.get('/:id/assets/status', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  const id = c.req.param('id');
  log.videoRoutes.info(reqId, 'Request received', { method: 'GET', path: `/:id/assets/status`, id });

  try {
    const video = await c.env.DB.prepare(`
      SELECT asset_status, asset_error
      FROM videos WHERE id = ?
    `).bind(id).first<{
      asset_status: string;
      asset_error: string | null;
    }>();

    if (!video) {
      log.videoRoutes.warn(reqId, 'Video not found', { id });
      return c.json({
        success: false,
        error: 'Video not found'
      }, 404);
    }

    // Check for stale 'generating' status (> 10 minutes)
    if (video.asset_status === 'generating') {
      const updatedResult = await c.env.DB.prepare(`
        SELECT updated_at FROM videos WHERE id = ?
      `).bind(id).first<{ updated_at: string }>();

      if (updatedResult) {
        const updatedAt = new Date(updatedResult.updated_at);
        const staleThreshold = 10 * 60 * 1000; // 10 minutes
        const now = new Date();

        if (now.getTime() - updatedAt.getTime() > staleThreshold) {
          // Auto-reset stale status
          await c.env.DB.prepare(`
            UPDATE videos
            SET asset_status = 'pending', asset_error = 'Generation timed out (stale status)', updated_at = datetime('now')
            WHERE id = ?
          `).bind(id).run();

          video.asset_status = 'pending';
          video.asset_error = 'Generation timed out (stale status)';
        }
      }
    }

    return c.json({
      success: true,
      status: video.asset_status,
      error: video.asset_error
    });
  } catch (error) {
    log.videoRoutes.error(reqId, 'Request failed', error as Error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get asset status'
    }, 500);
  } finally {
    const durationMs = Date.now() - startTime;
    log.videoRoutes.info(reqId, 'Request completed', { durationMs });
  }
});

// GET /api/videos/:id/assets/:assetId - Serve asset from R2
videoRoutes.get('/:id/assets/:assetId', async (c) => {
  const videoId = c.req.param('id');
  const assetId = c.req.param('assetId');

  try {
    const asset = await c.env.DB.prepare(`
      SELECT * FROM video_assets WHERE id = ? AND video_id = ?
    `).bind(assetId, videoId).first<VideoAsset>();

    if (!asset) {
      return c.json({ error: 'Asset not found' }, 404);
    }

    const r2 = new R2StorageService(c.env.ASSETS_BUCKET);
    const object = await r2.getAsset(asset.r2_key);

    if (!object) {
      return c.json({ error: 'Asset file not found in storage' }, 404);
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': asset.mime_type,
        'Content-Length': String(asset.file_size || 0),
        'Cache-Control': 'public, max-age=31536000'
      }
    });
  } catch (error) {
    log.assetRoutes.error('Asset retrieval failed', error as Error, { videoId, assetId });
    return c.json({ error: 'Failed to retrieve asset' }, 500);
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

// POST /api/videos/:id/render - Trigger video render workflow
videoRoutes.post('/:id/render', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  const id = parseInt(c.req.param('id'));
  log.videoRoutes.info(reqId, 'Request received', { method: 'POST', path: '/:id/render', videoId: id });

  try {
    // Validate video exists
    const video = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first<Video>();

    if (!video) {
      log.videoRoutes.warn(reqId, 'Video not found', { videoId: id });
      return c.json({ success: false, error: 'Video not found' }, 404);
    }

    if (video.asset_status !== 'generated') {
      log.videoRoutes.warn(reqId, 'Assets not generated yet', { videoId: id, assetStatus: video.asset_status });
      return c.json({ success: false, error: 'Assets not generated yet' }, 400);
    }

    if (video.render_status === 'rendering') {
      log.videoRoutes.warn(reqId, 'Render already in progress', { videoId: id });
      return c.json({ success: false, error: 'Render already in progress' }, 409);
    }

    const params: VideoRenderParams = { videoId: id };

    // Create workflow instance
    const instance = await c.env.VIDEO_RENDER_WORKFLOW.create({
      id: `render-${id}-${Date.now()}`,
      params
    });

    log.videoRoutes.info(reqId, 'Render workflow created', { workflowId: instance.id, videoId: id });
    return c.json({
      success: true,
      workflowId: instance.id
    });
  } catch (error) {
    log.videoRoutes.error(reqId, 'Request failed', error as Error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create render workflow'
    }, 500);
  } finally {
    const durationMs = Date.now() - startTime;
    log.videoRoutes.info(reqId, 'Request completed', { durationMs });
  }
});

// GET /api/videos/:id/render/status - Poll render status
videoRoutes.get('/:id/render/status', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  const id = c.req.param('id');
  log.videoRoutes.info(reqId, 'Request received', { method: 'GET', path: '/:id/render/status', videoId: id });

  try {
    const video = await c.env.DB.prepare(`
      SELECT render_status, render_error, render_started_at, render_completed_at
      FROM videos WHERE id = ?
    `).bind(id).first<{
      render_status: string;
      render_error: string | null;
      render_started_at: string | null;
      render_completed_at: string | null;
    }>();

    if (!video) {
      log.videoRoutes.warn(reqId, 'Video not found', { videoId: id });
      return c.json({ success: false, error: 'Video not found' }, 404);
    }

    // Fetch rendered video asset if exists
    const renderedAsset = await c.env.DB.prepare(`
      SELECT * FROM video_assets
      WHERE video_id = ? AND asset_type = 'rendered_video'
    `).bind(id).first<VideoAsset>();

    // Use direct R2 public URL for rendered video
    return c.json({
      success: true,
      renderStatus: video.render_status,
      renderError: video.render_error,
      renderStartedAt: video.render_started_at,
      renderCompletedAt: video.render_completed_at,
      renderedVideo: renderedAsset ? {
        id: renderedAsset.id,
        url: `${c.env.ASSETS_PUBLIC_URL}/${renderedAsset.r2_key}`,
        mimeType: renderedAsset.mime_type,
        fileSize: renderedAsset.file_size,
        metadata: renderedAsset.metadata ? JSON.parse(renderedAsset.metadata) : null
      } : null
    });
  } catch (error) {
    log.videoRoutes.error(reqId, 'Request failed', error as Error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get render status'
    }, 500);
  } finally {
    const durationMs = Date.now() - startTime;
    log.videoRoutes.info(reqId, 'Request completed', { durationMs });
  }
});

export { videoRoutes };
