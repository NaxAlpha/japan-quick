/**
 * Video API routes - Video selection workflow endpoints
 * GET /api/videos - List 10 most recent videos (supports ?page=N)
 * GET /api/videos/:id - Get single video with assets
 * DELETE /api/videos/:id - Delete video and cost logs
 * POST /api/videos/:id/generate-script - Generate video script
 * POST /api/videos/:id/generate-assets - Generate video assets (images + audio)
 * GET /api/videos/:id/assets/:assetId - Serve asset from R2
 * POST /api/videos/trigger - Manual workflow trigger
 * GET /api/videos/status/:workflowId - Workflow status
 */

import { Hono } from 'hono';
import type { Env } from '../types/news.js';
import type { Video, ParsedVideo, CostLog, VideoAsset, ParsedVideoAsset, VideoScript, TTS_VOICES } from '../types/video.js';
import type { VideoSelectionParams, VideoSelectionResult } from '../workflows/video-selection.workflow.js';
import type { VideoRenderParams, VideoRenderResult } from '../workflows/video-render.workflow.js';
import type { Article, ArticleVersion, ArticleComment } from '../types/article.js';
import { parseVideo, TTS_VOICES as TTSVoicesArray } from '../types/video.js';
import { log, generateRequestId } from '../lib/logger.js';
import { GeminiService } from '../services/gemini.js';
import { AssetGeneratorService } from '../services/asset-generator.js';
import { R2StorageService } from '../services/r2-storage.js';

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

    const assets: ParsedVideoAsset[] = (assetsResult.results as VideoAsset[]).map(asset => ({
      id: asset.id,
      assetType: asset.asset_type,
      assetIndex: asset.asset_index,
      url: `/api/videos/${id}/assets/${asset.id}`,
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

// POST /api/videos/:id/generate-assets - Generate grid images and slide audio
videoRoutes.post('/:id/generate-assets', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  const id = parseInt(c.req.param('id'));
  log.assetRoutes.info(reqId, 'Asset generation requested', { videoId: id });

  try {
    // 1. Fetch video and validate
    const video = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first<Video>();
    if (!video) {
      log.assetRoutes.warn(reqId, 'Video not found', { videoId: id });
      return c.json({ success: false, error: 'Video not found' }, 404);
    }
    if (video.script_status !== 'generated') {
      log.assetRoutes.warn(reqId, 'Script not generated yet', { videoId: id, scriptStatus: video.script_status });
      return c.json({ success: false, error: 'Script not generated yet' }, 400);
    }
    if (video.asset_status === 'generating') {
      log.assetRoutes.warn(reqId, 'Asset generation already in progress', { videoId: id });
      return c.json({ success: false, error: 'Asset generation in progress' }, 409);
    }

    // 2. Select random voice if not already set
    const ttsVoice = video.tts_voice || TTSVoicesArray[Math.floor(Math.random() * TTSVoicesArray.length)];

    // 3. Update status to generating
    await c.env.DB.prepare(`
      UPDATE videos SET asset_status = 'generating', tts_voice = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(ttsVoice, id).run();

    log.assetRoutes.info(reqId, 'Asset status set to generating', { videoId: id, ttsVoice });

    const script: VideoScript = JSON.parse(video.script!);

    // 4. Fetch article reference images
    const articleIds = JSON.parse(video.articles!);
    const referenceImages: string[] = [];

    // Import the image fetcher utility
    const { fetchImagesAsBase64 } = await import('../lib/image-fetcher.js');

    for (const pickId of articleIds) {
      const article = await c.env.DB.prepare(`
        SELECT id FROM articles WHERE pick_id = ?
      `).bind(pickId).first<{ id: number }>();

      if (!article) continue;

      const version = await c.env.DB.prepare(`
        SELECT images FROM article_versions
        WHERE article_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).bind(article.id).first<{ images: string | null }>();

      if (version?.images) {
        const images = JSON.parse(version.images) as Array<{ url: string }>;
        const imageUrls = images.map(img => img.url);

        // Fetch images and convert to base64 (max 3 per article)
        const fetchedImages = await fetchImagesAsBase64(imageUrls, 3);

        // Store as JSON strings for the asset generator
        for (const img of fetchedImages) {
          referenceImages.push(JSON.stringify(img));
        }

        log.assetRoutes.info(reqId, 'Fetched reference images', {
          pickId,
          fetchedCount: fetchedImages.length,
          totalCount: referenceImages.length
        });
      }
    }

    log.assetRoutes.info(reqId, 'Total reference images collected', {
      totalCount: referenceImages.length
    });

    // 5. Initialize services
    const assetGen = new AssetGeneratorService(c.env.GOOGLE_API_KEY);
    const r2 = new R2StorageService(c.env.ASSETS_BUCKET);

    // 6. Generate grid images and individual slide images
    log.assetRoutes.info(reqId, 'Generating grid images', { videoId: id, videoType: video.video_type });
    const { grids, slides } = await assetGen.generateGridImages(
      reqId, script, video.video_type, video.image_model, referenceImages
    );

    const gridImageAssetIds: string[] = [];
    const slideImageAssetIds: string[] = [];

    // 7. Upload grid images and create records
    for (let i = 0; i < grids.length; i++) {
      const img = grids[i];
      const data = Uint8Array.from(atob(img.base64), c => c.charCodeAt(0));
      const { key, size, publicUrl } = await r2.uploadAsset(img.ulid, data.buffer, img.mimeType);

      await c.env.DB.prepare(`
        INSERT INTO video_assets (video_id, asset_type, asset_index, r2_key, public_url, mime_type, file_size, metadata)
        VALUES (?, 'grid_image', ?, ?, ?, ?, ?, ?)
      `).bind(id, i, key, publicUrl, img.mimeType, size, JSON.stringify(img.metadata)).run();

      gridImageAssetIds.push(img.ulid);

      log.assetRoutes.info(reqId, `Grid ${i} uploaded`, { videoId: id, ulid: img.ulid, key, size });
    }

    // 7b. Upload individual slide images and create records
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const data = Uint8Array.from(atob(slide.base64), c => c.charCodeAt(0));
      const { key, size, publicUrl } = await r2.uploadAsset(slide.ulid, data.buffer, slide.mimeType);

      await c.env.DB.prepare(`
        INSERT INTO video_assets (video_id, asset_type, asset_index, r2_key, public_url, mime_type, file_size, metadata, generation_type)
        VALUES (?, 'slide_image', ?, ?, ?, ?, ?, ?, 'individual')
      `).bind(id, slide.metadata.slideIndex, key, publicUrl, slide.mimeType, size, JSON.stringify(slide.metadata)).run();

      slideImageAssetIds.push(slide.ulid);

      log.assetRoutes.info(reqId, `Slide image ${slide.metadata.slideIndex} uploaded`, { videoId: id, ulid: slide.ulid, key, size });
    }

    // 8. Generate and upload slide audio
    const slideAudioAssetIds: string[] = [];
    log.assetRoutes.info(reqId, 'Generating slide audio', { videoId: id, slideCount: script.slides.length });
    for (let i = 0; i < script.slides.length; i++) {
      const audio = await assetGen.generateSlideAudio(
        reqId, script.slides[i].audioNarration, ttsVoice, video.tts_model
      );

      // Set the correct slideIndex in metadata
      audio.metadata.slideIndex = i;

      const data = Uint8Array.from(atob(audio.base64), c => c.charCodeAt(0));
      const { key, size, publicUrl } = await r2.uploadAsset(audio.ulid, data.buffer, audio.mimeType);

      await c.env.DB.prepare(`
        INSERT INTO video_assets (video_id, asset_type, asset_index, r2_key, public_url, mime_type, file_size, metadata)
        VALUES (?, 'slide_audio', ?, ?, ?, ?, ?, ?)
      `).bind(id, i, key, publicUrl, audio.mimeType, size, JSON.stringify(audio.metadata)).run();

      slideAudioAssetIds.push(audio.ulid);

      log.assetRoutes.info(reqId, `Slide audio ${i} uploaded`, { videoId: id, ulid: audio.ulid, key, size, durationMs: audio.metadata.durationMs });
    }

    // 9. Log costs
    const gridCount = grids.length;
    const imageCost = gridCount * (video.image_model === 'gemini-2.5-flash-image' ? 0.039 : 0.134);
    await c.env.DB.prepare(`
      INSERT INTO cost_logs (video_id, log_type, model_id, input_tokens, output_tokens, cost)
      VALUES (?, 'image-generation', ?, 0, 0, ?)
    `).bind(id, video.image_model, imageCost).run();

    // Note: TTS cost logging would require token counts from Gemini API response
    // For now we're not logging TTS costs as the API doesn't return token usage

    // 10. Update video status
    const totalCostResult = await c.env.DB.prepare(`
      SELECT SUM(cost) as total FROM cost_logs WHERE video_id = ?
    `).bind(id).first<{ total: number }>();

    const totalCost = totalCostResult?.total || 0;

    await c.env.DB.prepare(`
      UPDATE videos SET asset_status = 'generated', slide_audio_asset_ids = ?, slide_image_asset_ids = ?, total_cost = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(JSON.stringify(slideAudioAssetIds), JSON.stringify(slideImageAssetIds), totalCost, id).run();

    log.assetRoutes.info(reqId, 'Asset generation completed', {
      videoId: id,
      gridCount,
      slideCount: script.slides.length,
      gridImageAssetIds,
      slideImageAssetIds,
      slideAudioAssetIds,
      totalCost,
      durationMs: Date.now() - startTime
    });

    return c.json({ success: true });
  } catch (error) {
    log.assetRoutes.error(reqId, 'Asset generation failed', error as Error, { videoId: id });
    await c.env.DB.prepare(`
      UPDATE videos SET asset_status = 'error', asset_error = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind((error as Error).message, id).run();
    return c.json({ success: false, error: (error as Error).message }, 500);
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

    return c.json({
      success: true,
      renderStatus: video.render_status,
      renderError: video.render_error,
      renderStartedAt: video.render_started_at,
      renderCompletedAt: video.render_completed_at,
      renderedVideo: renderedAsset ? {
        id: renderedAsset.id,
        url: `/api/videos/${id}/assets/${renderedAsset.id}`,
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
