/**
 * YouTubeUploadWorkflow - Upload rendered video to YouTube
 * Uses YouTube Data API v3 resumable upload process
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { YouTubeUploadService } from '../services/youtube-upload.js';
import { YouTubeAuthService } from '../services/youtube-auth.js';
import type { Video, VideoScript, YouTubeInfo } from '../types/video.js';
import type { Env } from '../types/env.js';
import type { YouTubeVideoStatus } from '../types/youtube.js';
import { log, generateRequestId } from '../lib/logger.js';
import { RETRY_POLICIES } from '../lib/constants.js';

export interface YouTubeUploadParams {
  videoId: number;
}

export interface YouTubeUploadResult {
  success: boolean;
  videoId?: number;
  youtubeVideoId?: string;
  youtubeVideoUrl?: string;
  error?: string;
}

export class YouTubeUploadWorkflow extends WorkflowEntrypoint<Env['Bindings'], YouTubeUploadParams, YouTubeUploadResult> {
  async run(event: WorkflowEvent<YouTubeUploadParams>, step: WorkflowStep): Promise<YouTubeUploadResult> {
    const reqId = generateRequestId();
    const workflowId = event.id;
    const { videoId } = event.payload;
    const startTime = Date.now();
    log.youTubeUploadWorkflow.info(reqId, 'Workflow started', { workflowId, videoId });

    try {
      // Step 1: Fetch and validate video with script, return both video and parsed script
      const { video, script } = await step.do('fetch-video', {
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
            render_status,
            youtube_upload_status
          FROM videos
          WHERE id = ?
        `).bind(videoId).first();

        if (!result) {
          throw new Error(`Video ${videoId} not found`);
        }

        const video = result as Video;

        // Validate video is rendered
        if (video.render_status !== 'rendered') {
          throw new Error(`Video not rendered (status: ${video.render_status})`);
        }

        if (!video.script) {
          throw new Error('Video script not found');
        }

        const script = JSON.parse(video.script) as VideoScript;

        return { video, script };
      });
      log.youTubeUploadWorkflow.info(reqId, 'Step completed', { step: 'fetch-video', durationMs: Date.now() - startTime });

      // Step 2: Update status to 'uploading'
      await step.do('update-status-uploading', async () => {
        await this.env.DB.prepare(`
          UPDATE videos
          SET youtube_upload_status = 'uploading',
              youtube_upload_error = NULL,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(videoId).run();
      });

      // Step 3: Fetch rendered video asset from R2
      const videoAsset = await step.do('fetch-rendered-video', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        const result = await this.env.DB.prepare(`
          SELECT r2_key
          FROM video_assets
          WHERE video_id = ? AND asset_type = 'rendered_video'
          ORDER BY created_at DESC
          LIMIT 1
        `).bind(videoId).first<{ r2_key: string }>();

        if (!result) {
          throw new Error('No rendered video asset found');
        }

        return result.r2_key;
      });
      log.youTubeUploadWorkflow.info(reqId, 'Step completed', { step: 'fetch-rendered-video', r2Key: videoAsset });

      // Step 4: Get access token
      const accessToken = await step.do('get-access-token', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        const youtubeAuth = new YouTubeAuthService(
          this.env.DB,
          this.env.NEWS_CACHE,
          this.env.YOUTUBE_CLIENT_ID,
          this.env.YOUTUBE_CLIENT_SECRET,
          this.env.YOUTUBE_REDIRECT_URI
        );
        return await youtubeAuth.getAccessToken(reqId);
      });

      // Step 5: Create upload session, upload video, and create YouTube info record in one step
      // This avoids Cloudflare Workflow serialization limits for large data and closure issues
      const { youtubeVideoId, youtubeInfoId, sizeBytes, sizeMB } = await step.do('upload-and-create-info', {
        retries: {
          limit: 1, // Upload is expensive, don't retry automatically
          delay: '5 seconds',
          backoff: 'constant'
        },
        timeout: 3600000 // 60 minutes for large video uploads
      }, async () => {
        // Create upload session
        const uploadService = new YouTubeUploadService(accessToken);
        const { uploadUrl } = await uploadService.createUploadSession(reqId, script);
        log.youTubeUploadWorkflow.info(reqId, 'Upload session created');

        // Get video from R2 (streaming, no memory load)
        const object = await this.env.ASSETS_BUCKET.get(videoAsset);
        if (!object) {
          throw new Error(`Video file not found in R2: ${videoAsset}`);
        }
        if (!object.body) {
          throw new Error(`Video file has no body stream: ${videoAsset}`);
        }

        const videoSizeBytes = object.size;
        log.youTubeUploadWorkflow.info(reqId, 'Got video stream from R2', {
          sizeBytes: videoSizeBytes,
          sizeMB: (videoSizeBytes / 1024 / 1024).toFixed(2)
        });

        // Upload to YouTube via streaming and get the actual video ID
        const actualVideoId = await uploadService.uploadVideoStream(reqId, uploadUrl, object.body, videoSizeBytes);
        log.youTubeUploadWorkflow.info(reqId, 'Video uploaded to YouTube', { youtubeVideoId: actualVideoId });

        // Build and create YouTube info record
        const youtubeInfo = uploadService.buildYouTubeInfo(reqId, videoId, actualVideoId, script);
        const completedInfo = uploadService.updateYouTubeInfoCompletion(reqId, youtubeInfo as YouTubeInfo);

        const result = await this.env.DB.prepare(`
          INSERT INTO youtube_info (
            video_id, youtube_video_id, youtube_video_url, title, description,
            privacy_status, tags, category_id, made_for_kids, self_declared_made_for_kids,
            contains_synthetic_media, not_paid_content, upload_started_at, upload_completed_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `).bind(
          completedInfo.video_id,
          completedInfo.youtube_video_id,
          completedInfo.youtube_video_url,
          completedInfo.title,
          completedInfo.description,
          completedInfo.privacy_status,
          completedInfo.tags,
          completedInfo.category_id,
          completedInfo.made_for_kids,
          completedInfo.self_declared_made_for_kids,
          completedInfo.contains_synthetic_media,
          completedInfo.not_paid_content,
          completedInfo.upload_started_at,
          completedInfo.upload_completed_at
        ).first<{ id: number }>();

        if (!result) {
          throw new Error('Failed to create YouTube info record');
        }

        log.youTubeUploadWorkflow.info(reqId, 'YouTube info record created', { youtubeInfoId: result.id });

        return {
          youtubeVideoId: actualVideoId,
          youtubeInfoId: result.id,
          sizeBytes: videoSizeBytes,
          sizeMB: (videoSizeBytes / 1024 / 1024).toFixed(2)
        };
      });
      log.youTubeUploadWorkflow.info(reqId, 'Step completed', { step: 'upload-and-create-info', youtubeVideoId, youtubeInfoId, sizeBytes, sizeMB });

      // Step 6: Update status to 'processing'
      await step.do('update-status-processing', async () => {
        await this.env.DB.prepare(`
          UPDATE videos
          SET youtube_upload_status = 'processing',
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(videoId).run();
      });

      // Step 7: Poll for YouTube processing completion
      const finalStatus = await step.do('poll-processing-status', {
        retries: {
          limit: 1, // Don't retry polling errors
          delay: '5 seconds',
          backoff: 'constant'
        },
        timeout: 3600000 // 60 minutes max for processing
      }, async () => {
        const uploadService = new YouTubeUploadService(accessToken);
        return await uploadService.pollProcessingStatus(reqId, youtubeVideoId);
      });
      log.youTubeUploadWorkflow.info(reqId, 'Step completed', {
        step: 'poll-processing-status',
        finalStatus: finalStatus.uploadStatus,
        processingStatus: finalStatus.processingStatus
      });

      // Check for upload failure
      if (finalStatus.uploadStatus === 'rejected' || finalStatus.uploadStatus === 'failed') {
        const errorReason = finalStatus.rejectionReason || finalStatus.failureReason || 'Upload failed';
        throw new Error(`YouTube rejected or failed to process video: ${errorReason}`);
      }

      // Step 8: Upload thumbnail
      await step.do('upload-thumbnail', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '5 seconds',
          backoff: 'exponential'
        }
      }, async () => {
        // Query for thumbnail_image asset
        const thumbnailAsset = await this.env.DB.prepare(`
          SELECT r2_key
          FROM video_assets
          WHERE video_id = ? AND asset_type = 'thumbnail_image'
          ORDER BY created_at DESC
          LIMIT 1
        `).bind(videoId).first<{ r2_key: string }>();

        if (!thumbnailAsset) {
          log.youTubeUploadWorkflow.warn(reqId, 'No thumbnail asset found, skipping thumbnail upload', { videoId });
          return;
        }

        // Fetch thumbnail from R2
        const object = await this.env.ASSETS_BUCKET.get(thumbnailAsset.r2_key);
        if (!object) {
          throw new Error(`Thumbnail file not found in R2: ${thumbnailAsset.r2_key}`);
        }

        // Convert stream to bytes
        const chunks: Uint8Array[] = [];
        const reader = object.body.getReader();
        let totalSize = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalSize += value.length;
          }
        } finally {
          reader.releaseLock();
        }

        // Combine chunks into single Uint8Array
        const thumbnailBytes = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of chunks) {
          thumbnailBytes.set(chunk, offset);
          offset += chunk.length;
        }

        log.youTubeUploadWorkflow.info(reqId, 'Uploading thumbnail to YouTube', {
          videoId,
          youtubeVideoId,
          thumbnailSize: totalSize,
          thumbnailSizeMB: (totalSize / 1024 / 1024).toFixed(2)
        });

        // Upload thumbnail to YouTube
        const uploadService = new YouTubeUploadService(accessToken);
        await uploadService.uploadThumbnail(reqId, accessToken, youtubeVideoId, thumbnailBytes);

        log.youTubeUploadWorkflow.info(reqId, 'Thumbnail uploaded successfully', {
          videoId,
          youtubeVideoId
        });
      });

      // Step 9: Update status to 'uploaded'
      await step.do('update-status-uploaded', async () => {
        await this.env.DB.prepare(`
          UPDATE videos
          SET youtube_upload_status = 'uploaded',
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(videoId).run();
      });

      log.youTubeUploadWorkflow.info(reqId, 'Workflow completed', {
        durationMs: Date.now() - startTime,
        videoId,
        youtubeVideoId,
        youtubeInfoId
      });

      return {
        success: true,
        videoId,
        youtubeVideoId,
        youtubeVideoUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`
      };
    } catch (error) {
      log.youTubeUploadWorkflow.error(reqId, 'Workflow failed', error as Error, { videoId });

      try {
        await this.env.DB.prepare(`
          UPDATE videos
          SET youtube_upload_status = 'error',
              youtube_upload_error = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(error instanceof Error ? error.message : 'Unknown error', videoId).run();
      } catch (updateError) {
        log.youTubeUploadWorkflow.error(reqId, 'Failed to update video status to error', updateError as Error);
      }

      return {
        success: false,
        videoId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
