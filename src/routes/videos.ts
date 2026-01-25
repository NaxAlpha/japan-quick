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
import type { Article, ArticleVersion, ArticleComment } from '../types/article.js';
import { parseVideo } from '../types/video.js';
import { log, generateRequestId } from '../lib/logger.js';
import { GeminiService } from '../services/gemini.js';

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

// POST /api/videos/:id/generate-script - Generate video script
videoRoutes.post('/:id/generate-script', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  const id = c.req.param('id');
  log.videoRoutes.info(reqId, 'Request received', { method: 'POST', path: `/:id/generate-script`, id });

  try {
    // 1. Validate video exists and can generate
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

    if (video.script_status === 'generating') {
      log.videoRoutes.warn(reqId, 'Script generation already in progress', { id });
      return c.json({
        success: false,
        error: 'Script generation already in progress'
      }, 400);
    }

    // 2. Set script_status = 'generating'
    await c.env.DB.prepare(`
      UPDATE videos
      SET script_status = 'generating', script_error = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).bind(id).run();

    log.videoRoutes.info(reqId, 'Script status set to generating', { videoId: id });

    // 3. Fetch article content, comments, images from DB
    const articlePickIds = video.articles ? JSON.parse(video.articles) : [];

    if (articlePickIds.length === 0) {
      throw new Error('No articles selected for this video');
    }

    log.videoRoutes.info(reqId, 'Fetching article data', { articleCount: articlePickIds.length });

    const articlesWithContent = [];
    for (const pickId of articlePickIds) {
      // Fetch article
      const article = await c.env.DB.prepare(`
        SELECT * FROM articles WHERE pick_id = ?
      `).bind(pickId).first<Article>();

      if (!article) {
        log.videoRoutes.warn(reqId, 'Article not found', { pickId });
        continue;
      }

      // Fetch latest version
      const version = await c.env.DB.prepare(`
        SELECT * FROM article_versions
        WHERE article_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).bind(article.id).first<ArticleVersion>();

      if (!version) {
        log.videoRoutes.warn(reqId, 'No article version found', { pickId, articleId: article.id });
        continue;
      }

      // Fetch comments
      const commentsResult = await c.env.DB.prepare(`
        SELECT * FROM article_comments
        WHERE article_id = ? AND version = ?
        ORDER BY likes DESC
        LIMIT 20
      `).bind(article.id, version.version).all();

      const comments = (commentsResult.results as ArticleComment[]).map(comment => ({
        author: comment.author,
        content: comment.content,
        likes: comment.likes,
        replies: comment.replies ? JSON.parse(comment.replies) : []
      }));

      // Parse images
      const images = version.images ? JSON.parse(version.images) : [];

      articlesWithContent.push({
        pickId: article.pickId,
        title: article.title || 'Untitled',
        content: version.content,
        contentText: version.contentText,
        comments,
        images
      });
    }

    if (articlesWithContent.length === 0) {
      throw new Error('No article content available');
    }

    log.videoRoutes.info(reqId, 'Article data fetched', { count: articlesWithContent.length });

    // 4. Call geminiService.generateScript()
    const geminiService = new GeminiService(c.env.GOOGLE_API_KEY);
    const result = await geminiService.generateScript(reqId, {
      videoType: video.video_type,
      articles: articlesWithContent
    });

    const { script, tokenUsage } = result;

    log.videoRoutes.info(reqId, 'Script generated successfully', {
      slideCount: script.slides.length,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens
    });

    // 5. Log cost to cost_logs
    const modelId = 'gemini-3-flash-preview';
    const inputCostPerMillion = 0.50;
    const outputCostPerMillion = 3.00;
    const cost = (tokenUsage.inputTokens / 1_000_000) * inputCostPerMillion +
                 (tokenUsage.outputTokens / 1_000_000) * outputCostPerMillion;

    await c.env.DB.prepare(`
      INSERT INTO cost_logs (video_id, log_type, model_id, attempt_id, input_tokens, output_tokens, cost)
      VALUES (?, 'script-generation', ?, 1, ?, ?, ?)
    `).bind(id, modelId, tokenUsage.inputTokens, tokenUsage.outputTokens, cost).run();

    log.videoRoutes.info(reqId, 'Cost logged', { cost });

    // 6. Update video with script and script_status = 'generated'
    const scriptJson = JSON.stringify(script);
    await c.env.DB.prepare(`
      UPDATE videos
      SET script = ?, script_status = 'generated', updated_at = datetime('now')
      WHERE id = ?
    `).bind(scriptJson, id).run();

    // 7. Update total_cost (sum of all cost logs)
    const totalCostResult = await c.env.DB.prepare(`
      SELECT SUM(cost) as total FROM cost_logs WHERE video_id = ?
    `).bind(id).first<{ total: number }>();

    const totalCost = totalCostResult?.total || 0;

    await c.env.DB.prepare(`
      UPDATE videos SET total_cost = ? WHERE id = ?
    `).bind(totalCost, id).run();

    log.videoRoutes.info(reqId, 'Video updated with script', { totalCost });

    // 8. Return updated video
    const updatedVideo = await c.env.DB.prepare(`
      SELECT * FROM videos WHERE id = ?
    `).bind(id).first<Video>();

    return c.json({
      success: true,
      video: parseVideo(updatedVideo!)
    });
  } catch (error) {
    // On error, set script_status = 'error' and store error message
    await c.env.DB.prepare(`
      UPDATE videos
      SET script_status = 'error', script_error = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(error instanceof Error ? error.message : 'Unknown error', id).run();

    log.videoRoutes.error(reqId, 'Script generation failed', error as Error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate script'
    }, 500);
  } finally {
    const durationMs = Date.now() - startTime;
    log.videoRoutes.info(reqId, 'Request completed', { durationMs });
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
