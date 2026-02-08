/**
 * VideoRenderWorkflow - Render final video from generated assets using ffmpeg
 * Uses e2b sandbox with ffmpeg for video processing
 * Individual slide images are already created by asset generator and stored in R2
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { renderVideo } from '../services/video-renderer.js';
import type { Video, VideoAsset, VideoScript } from '../types/video.js';
import type { Env } from '../types/env.js';
import { log, generateRequestId } from '../lib/logger.js';
import { RETRY_POLICIES } from '../lib/constants.js';
import { getUploadPrivacyForPolicyStatus, normalizePolicyStageStatus } from '../lib/policy.js';

export interface VideoRenderParams {
  videoId: number;
}

export interface VideoRenderResult {
  success: boolean;
  videoId?: number;
  assetId?: number;
  error?: string;
}

function parseStringArray(rawValue: string | null): string[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  } catch {
    return [];
  }
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
          limit: RETRY_POLICIES.DEFAULT.limit,
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
            video_type,
            articles,
            slide_audio_asset_ids,
            image_model,
            policy_overall_status,
            policy_block_reasons
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

      // Step 3: Fetch slide images and audio assets from D1
      const assets = await step.do('fetch-assets', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
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
            public_url,
            metadata
          FROM video_assets
          WHERE video_id = ?
            AND asset_type IN ('slide_image', 'slide_audio')
          ORDER BY asset_type, asset_index
        `).bind(videoId).all();

        return result.results as VideoAsset[];
      });
      log.videoRenderWorkflow.info(reqId, 'Step completed', { step: 'fetch-assets', assetCount: assets.length });

      const slideImageAssets = assets.filter(a => a.asset_type === 'slide_image');
      const audioAssets = assets.filter(a => a.asset_type === 'slide_audio');

      if (slideImageAssets.length === 0) {
        throw new Error('No slide images found. Asset generation may need to be run again.');
      }

      if (audioAssets.length === 0) {
        throw new Error('No audio assets found');
      }

      // Step 4: Fetch article date for date badge
      const articleDate = await step.do('fetch-article-date', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
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

      // Step 5: Prepare slide images and audio for rendering
      const { slideImages, audio } = await step.do('prepare-render-inputs', async () => {
        // Build slide images from slide_image assets
        const slideImages = slideImageAssets.map(asset => {
          if (!asset.public_url) {
            throw new Error(`Slide image asset ${asset.id} missing public_url`);
          }
          const metadata = JSON.parse(asset.metadata || '{}');
          return {
            url: asset.public_url,
            slideIndex: asset.asset_index,
            width: metadata.width || 0,
            height: metadata.height || 0
          };
        });

        // Build audio from audio assets
        const audio = audioAssets.map(asset => {
          if (!asset.public_url) {
            throw new Error(`Audio asset ${asset.id} missing public_url`);
          }
          const metadata = JSON.parse(asset.metadata || '{}');

          if (metadata.durationMs === undefined || metadata.durationMs === null) {
            throw new Error(
              `Audio asset ${asset.id} (slideIndex: ${asset.asset_index}) missing durationMs in metadata`
            );
          }

          return {
            url: asset.public_url,
            slideIndex: asset.asset_index,
            durationMs: metadata.durationMs
          };
        });

        return { slideImages, audio };
      });
      log.videoRenderWorkflow.info(reqId, 'Step completed', { step: 'prepare-render-inputs' });

      // Step 6: Render video using e2b sandbox
      // Try both dot and bracket notation for secret access
      const e2bKey = this.env.E2B_API_KEY || (this.env as any)['E2B_API_KEY'] || '';

      log.videoRenderWorkflow.info(reqId, 'Starting video render with e2b sandbox', {
        videoType: video.video_type,
        slideCount: script.slides.length,
        slideImageCount: slideImages.length,
        audioCount: audio.length,
        hasE2BKey: !!e2bKey,
        e2bKeyLength: e2bKey?.length || 0,
        e2bKeyPrefix: e2bKey?.substring(0, 10) || 'none'
      });

      const renderStartTime = Date.now();

      // Generate R2 key for the video
      const { ulid } = await import('ulid');
      const videoUlid = ulid();
      const r2Key = `${videoUlid}.mp4`;

      // Step 6: Render video with E2B (resolution based on model - uploads directly to R2)
      const renderResult = await step.do('render-video', {
        retries: {
          // Avoid duplicate expensive render attempts and preserve first failure reason.
          limit: 0,
          delay: '30 seconds',
          backoff: 'constant'
        },
        timeout: 3600000 // 60 minutes to allow long video renders + upload
      }, async () => {
        return await renderVideo(reqId, e2bKey, {
          script,
          videoType: video.video_type,
          slideImages,
          audio,
          articleDate,
          imageModel: video.image_model,
          r2Bucket: this.env.ASSETS_BUCKET, // Pass R2 bucket for direct upload
          r2Key // Pass R2 key for upload
        });
      });

      const renderDuration = Date.now() - renderStartTime;
      log.videoRenderWorkflow.info(reqId, 'Render and upload completed', {
        durationMs: renderDuration,
        r2Key: renderResult.r2Key,
        fileSize: renderResult.fileSize,
        fileSizeMB: ((renderResult.fileSize || 0) / 1024 / 1024).toFixed(2),
        videoDurationMs: renderResult.metadata.durationMs
      });

      // Verify we got the R2 key back
      if (!renderResult.r2Key) {
        throw new Error('Render completed but no R2 key returned');
      }

      const fileSize = renderResult.fileSize || 0;

      // Skip the separate upload step since renderVideo now handles it

      // Step 8: Create asset record
      const assetId = await step.do('create-asset-record', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        const result = await this.env.DB.prepare(`
          INSERT INTO video_assets (video_id, asset_type, asset_index, r2_key, mime_type, file_size, metadata, public_url, generation_type)
          VALUES (?, 'rendered_video', 0, ?, 'video/mp4', ?, ?, ?, 'individual')
          RETURNING id
        `).bind(
          videoId,
          r2Key,
          fileSize,
          JSON.stringify(renderResult.metadata),
          `https://japan-quick-assets.nauman.im/${r2Key}`
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

      // Step 10: Resolve policy-driven upload behavior
      const uploadPolicy = await step.do('resolve-upload-policy', async () => {
        const policyStatus = normalizePolicyStageStatus(video.policy_overall_status);
        const uploadPrivacy = getUploadPrivacyForPolicyStatus(policyStatus);
        const blockReasons = parseStringArray(video.policy_block_reasons);

        if (uploadPrivacy === null) {
          const message = blockReasons.length > 0
            ? `Policy BLOCK: ${blockReasons.join(' | ')}`
            : `Policy status ${policyStatus} blocks upload`;

          await this.env.DB.prepare(`
            UPDATE videos
            SET youtube_upload_status = 'blocked',
                youtube_upload_error = ?,
                updated_at = datetime('now')
            WHERE id = ?
          `).bind(message, videoId).run();

          return {
            blocked: true,
            policyStatus,
            privacy: null,
            message
          };
        }

        const message = policyStatus === 'CLEAN'
          ? null
          : `Policy status ${policyStatus}: upload forced to private`;

        await this.env.DB.prepare(`
          UPDATE videos
          SET youtube_upload_status = 'pending',
              youtube_upload_error = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(message, videoId).run();

        return {
          blocked: false,
          policyStatus,
          privacy: uploadPrivacy,
          message
        };
      });
      log.videoRenderWorkflow.info(reqId, 'Step completed', {
        step: 'resolve-upload-policy',
        policyStatus: uploadPolicy.policyStatus,
        blocked: uploadPolicy.blocked,
        privacy: uploadPolicy.privacy || 'none'
      });

      // Step 11: Trigger YouTube upload workflow (unless blocked)
      await step.do('trigger-youtube-upload', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        if (uploadPolicy.blocked) {
          log.videoRenderWorkflow.warn(reqId, 'YouTube upload skipped due to policy block', {
            videoId,
            message: uploadPolicy.message
          });
          return;
        }

        const params = {
          videoId,
          privacy: uploadPolicy.privacy as 'public' | 'private'
        };
        await this.env.YOUTUBE_UPLOAD_WORKFLOW.create({
          id: `youtube-upload-${videoId}-${Date.now()}`,
          params
        });
        log.videoRenderWorkflow.info(reqId, 'YouTube upload workflow triggered', {
          videoId,
          privacy: uploadPolicy.privacy
        });
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
