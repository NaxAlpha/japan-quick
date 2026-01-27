/**
 * VideoRenderWorkflow - Render final video from generated assets using ffmpeg
 * Uses Cloudflare Sandbox with ffmpeg for video processing
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { getSandbox } from '@cloudflare/sandbox';
import { renderVideo } from '../services/video-renderer.js';
import type { Video, VideoAsset, VideoScript } from '../types/video.js';
import type { Env } from '../types/news.js';
import { log, generateRequestId } from '../lib/logger.js';

export interface VideoRenderParams {
  videoId: number;
}

export interface VideoRenderResult {
  success: boolean;
  videoId?: number;
  assetId?: number;
  error?: string;
}

export class VideoRenderWorkflow extends WorkflowEntrypoint<Env['Bindings'], VideoRenderParams, VideoRenderResult> {
  async run(event: WorkflowEvent<VideoRenderParams>, step: WorkflowStep): Promise<VideoRenderResult> {
    const reqId = generateRequestId();
    const workflowId = event.id;
    const { videoId } = event.payload;
    const startTime = Date.now();
    log.videoRenderWorkflow.info(reqId, 'Workflow started', { workflowId, videoId });

    try {
      // Step 1: Fetch and validate video
      const video = await step.do('fetch-video', {
        retries: {
          limit: 3,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        const result = await this.env.DB.prepare(`
          SELECT
            id,
            script,
            script_status,
            asset_status,
            video_type
          FROM videos
          WHERE id = ?
        `).bind(videoId).first();

        if (!result) {
          throw new Error(`Video ${videoId} not found`);
        }

        return result as Video;
      });
      log.videoRenderWorkflow.info(reqId, 'Step completed', { step: 'fetch-video', durationMs: Date.now() - startTime });

      // Validate assets are generated
      if (video.asset_status !== 'generated') {
        throw new Error(`Video assets not generated (status: ${video.asset_status})`);
      }

      if (!video.script) {
        throw new Error('Video script not found');
      }

      const script: VideoScript = JSON.parse(video.script);

      // Step 2: Update status to 'rendering'
      await step.do('update-status-rendering', async () => {
        await this.env.DB.prepare(`
          UPDATE videos
          SET render_status = 'rendering',
              render_started_at = datetime('now'),
              render_error = NULL,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(videoId).run();
      });

      // Step 3: Fetch assets from D1
      const assets = await step.do('fetch-assets', {
        retries: {
          limit: 3,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        const result = await this.env.DB.prepare(`
          SELECT
            id,
            asset_type,
            asset_index,
            r2_key,
            metadata
          FROM video_assets
          WHERE video_id = ?
          ORDER BY asset_type, asset_index
        `).bind(videoId).all();

        return result.results as VideoAsset[];
      });
      log.videoRenderWorkflow.info(reqId, 'Step completed', { step: 'fetch-assets', assetCount: assets.length });

      // Separate grid images and audio
      const gridAssets = assets.filter(a => a.asset_type === 'grid_image');
      const audioAssets = assets.filter(a => a.asset_type === 'slide_audio');

      if (gridAssets.length === 0 || audioAssets.length === 0) {
        throw new Error('Missing grid images or audio assets');
      }

      // Step 4: Fetch article date for date badge
      const articleDate = await step.do('fetch-article-date', {
        retries: {
          limit: 3,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        // Get first article from video
        const articles = JSON.parse(video.articles || '[]');
        if (articles.length === 0) {
          return new Date().toISOString();
        }

        const pickId = articles[0];
        const result = await this.env.DB.prepare(`
          SELECT published_at
          FROM articles
          WHERE pick_id = ?
        `).bind(pickId).first<{ published_at: string }>();

        return result?.published_at || new Date().toISOString();
      });
      log.videoRenderWorkflow.info(reqId, 'Step completed', { step: 'fetch-article-date', articleDate });

      // Step 5: Prepare asset metadata with public URLs
      // Generate base URL for asset downloads (using auth credentials in URL)
      const { grids, audio } = await step.do('prepare-asset-metadata', async () => {
        // Build asset URL base with auth credentials
        // TODO: Make this configurable via environment variable
        const workerHost = 'japan-quick.nax.workers.dev';
        const assetUrlBase = `https://${this.env.ADMIN_USERNAME}:${this.env.ADMIN_PASSWORD}@${workerHost}/api/videos/${videoId}/assets`;

        // Extract grid metadata with URLs
        const grids = gridAssets.map(asset => {
          const metadata = JSON.parse(asset.metadata || '{}');
          return {
            url: `${assetUrlBase}/${asset.id}`,
            gridIndex: asset.asset_index,
            width: metadata.width || 1920,
            height: metadata.height || 1080,
            cellWidth: metadata.cellWidth || 640,
            cellHeight: metadata.cellHeight || 360
          };
        });

        // Extract audio metadata with URLs
        const audio = audioAssets.map(asset => {
          const metadata = JSON.parse(asset.metadata || '{}');
          return {
            url: `${assetUrlBase}/${asset.id}`,
            slideIndex: asset.asset_index,
            durationMs: metadata.durationMs || 10000
          };
        });

        return { grids, audio };
      });
      log.videoRenderWorkflow.info(reqId, 'Step completed', { step: 'prepare-asset-metadata' });

      // Step 6: Render video using VideoRendererService
      // CRITICAL: Do NOT use step.do for rendering because:
      // 1. The Sandbox proxy cannot be serialized by the workflow framework
      // 2. The R2 bucket cannot be captured in the closure
      // We do rendering as a direct async call instead
      const sandboxId = `render-${reqId}`;
      const sandbox = getSandbox(this.env.Sandbox, sandboxId);
      const renderResult = await renderVideo(reqId, sandbox, {
        script,
        videoType: video.video_type,
        grids,
        audio,
        articleDate
      });
      log.videoRenderWorkflow.info(reqId, 'Render completed', { durationMs: renderResult.metadata.durationMs });

      // Step 7: Upload video to R2
      const r2Key = `videos/${videoId}/rendered_${crypto.randomUUID()}.webm`;
      const fileSize = await step.do('upload-video', {
        retries: {
          limit: 3,
          delay: '3 seconds',
          backoff: 'exponential'
        }
      }, async () => {
        // Decode base64 to binary
        const binaryString = atob(renderResult.videoBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        await this.env.ASSETS_BUCKET.put(r2Key, bytes, {
          customMetadata: {
            videoId: videoId.toString(),
            contentType: 'video/webm'
          }
        });

        return bytes.length;
      });
      log.videoRenderWorkflow.info(reqId, 'Step completed', { step: 'upload-video', r2Key, fileSize });

      // Step 8: Create asset record
      const assetId = await step.do('create-asset-record', {
        retries: {
          limit: 3,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        const result = await this.env.DB.prepare(`
          INSERT INTO video_assets (video_id, asset_type, asset_index, r2_key, mime_type, file_size, metadata)
          VALUES (?, 'rendered_video', 0, ?, 'video/webm', ?, ?)
          RETURNING id
        `).bind(
          videoId,
          r2Key,
          fileSize,
          JSON.stringify(renderResult.metadata)
        ).first<{ id: number }>();

        if (!result) {
          throw new Error('Failed to create asset record');
        }

        return result.id;
      });
      log.videoRenderWorkflow.info(reqId, 'Step completed', { step: 'create-asset-record', assetId });

      // Step 9: Update status to 'rendered'
      await step.do('update-status-rendered', async () => {
        await this.env.DB.prepare(`
          UPDATE videos
          SET render_status = 'rendered',
              render_completed_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(videoId).run();
      });

      log.videoRenderWorkflow.info(reqId, 'Workflow completed', {
        durationMs: Date.now() - startTime,
        videoId,
        assetId
      });

      return {
        success: true,
        videoId,
        assetId
      };
    } catch (error) {
      log.videoRenderWorkflow.error(reqId, 'Workflow failed', error as Error, { videoId });

      // Update video status to error
      try {
        await this.env.DB.prepare(`
          UPDATE videos
          SET render_status = 'error',
              render_error = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(error instanceof Error ? error.message : 'Unknown error', videoId).run();
      } catch (updateError) {
        log.videoRenderWorkflow.error(reqId, 'Failed to update video status to error', updateError as Error);
      }

      return {
        success: false,
        videoId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
