/**
 * AssetGenerationWorkflow - Generate grid images and slide audio using Gemini AI
 * Converts synchronous asset generation to asynchronous workflow
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { AssetGeneratorService } from '../services/asset-generator.js';
import { R2StorageService } from '../services/r2-storage.js';
import { fetchImagesAsBase64 } from '../lib/image-fetcher.js';
import { ulid } from 'ulid';
import type { Video, VideoScript, VideoAsset, TTSVoice } from '../types/video.js';
import type { Env } from '../types/env.js';
import { log, generateRequestId } from '../lib/logger.js';
import { RETRY_POLICIES, SCRAPING, VIDEO_RENDERING } from '../lib/constants.js';

export interface AssetGenerationParams {
  videoId: number;
}

export interface AssetGenerationResult {
  success: boolean;
  videoId?: number;
  gridCount?: number;
  slideCount?: number;
  promptCount?: number;
  error?: string;
}

export class AssetGenerationWorkflow extends WorkflowEntrypoint<Env['Bindings'], AssetGenerationParams, AssetGenerationResult> {
  async run(event: WorkflowEvent<AssetGenerationParams>, step: WorkflowStep): Promise<AssetGenerationResult> {
    const reqId = generateRequestId();
    const workflowId = event.id;
    const { videoId } = event.payload;
    const startTime = Date.now();
    log.assetGenerationWorkflow.info(reqId, 'Workflow started', { workflowId, videoId });

    try {
      // Step 1: Validate prerequisites
      const video = await step.do('validate-prerequisites', {
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
            image_model,
            tts_model,
            tts_voice,
            articles
          FROM videos
          WHERE id = ?
        `).bind(videoId).first();

        if (!result) {
          throw new Error(`Video ${videoId} not found`);
        }

        return result as Video;
      });
      log.assetGenerationWorkflow.info(reqId, 'Step completed', { step: 'validate-prerequisites', durationMs: Date.now() - startTime });

      if (video.script_status !== 'generated') {
        throw new Error(`Script not generated yet (status: ${video.script_status})`);
      }

      if (!video.script) {
        throw new Error('Video script not found');
      }

      if (video.asset_status === 'generating') {
        throw new Error('Asset generation already in progress');
      }

      const script: VideoScript = JSON.parse(video.script);

      // Step 2: Select TTS voice and update status
      const ttsVoice = await step.do('select-tts-voice', async () => {
        const TTS_VOICES: TTSVoice[] = [
          'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Enceladus',
          'Aoede', 'Autonoe', 'Laomedeia', 'Iapetus', 'Erinome', 'Alnilam',
          'Algieba', 'Despina', 'Umbriel', 'Callirrhoe', 'Achernar', 'Sulafat',
          'Vindemiatrix', 'Achird', 'Orus', 'Algenib', 'Rasalgethi', 'Gacrux',
          'Pulcherrima', 'Zubenelgenubi', 'Sadachbia', 'Sadaltager'
        ];

        const selectedVoice = video.tts_voice || TTS_VOICES[Math.floor(Math.random() * TTS_VOICES.length)];

        // Update status to generating
        await this.env.DB.prepare(`
          UPDATE videos
          SET asset_status = 'generating', tts_voice = ?, asset_error = NULL, updated_at = datetime('now')
          WHERE id = ?
        `).bind(selectedVoice, videoId).run();

        return selectedVoice;
      });
      log.assetGenerationWorkflow.info(reqId, 'Step completed', { step: 'select-tts-voice', ttsVoice });

      // Step 3: Fetch reference images
      const referenceImages = await step.do('fetch-reference-images', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        const articleIds = JSON.parse(video.articles || '[]');
        const images: string[] = [];

        for (const pickId of articleIds) {
          const article = await this.env.DB.prepare(`
            SELECT id FROM articles WHERE pick_id = ?
          `).bind(pickId).first<{ id: number }>();

          if (!article) continue;

          const version = await this.env.DB.prepare(`
            SELECT images FROM article_versions
            WHERE article_id = ?
            ORDER BY version DESC
            LIMIT 1
          `).bind(article.id).first<{ images: string | null }>();

          if (version?.images) {
            const imagesData = JSON.parse(version.images) as Array<{ url: string }>;
            const imageUrls = imagesData.map(img => img.url);

            // Fetch images and convert to base64 (max 3 per article)
            const fetchedImages = await fetchImagesAsBase64(reqId, imageUrls, 3);

            // Store as JSON strings for the asset generator
            for (const img of fetchedImages) {
              images.push(JSON.stringify(img));
            }

            log.assetGenerationWorkflow.info(reqId, 'Fetched reference images', {
              pickId,
              fetchedCount: fetchedImages.length,
              totalCount: images.length
            });
          }
        }

        return images;
      });
      log.assetGenerationWorkflow.info(reqId, 'Step completed', { step: 'fetch-reference-images', totalImages: referenceImages.length });

      // Step 4: Generate grid images and individual slides
      // Uploads everything directly to R2 to avoid 1MiB step output limit
      // Returns grid count, prompts, and token usage for cost logging
      const { gridCount, prompts, tokenUsage } = await step.do('generate-images', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '5 seconds',
          backoff: 'exponential'
        }
      }, async () => {
        const assetGen = new AssetGeneratorService(this.env.GOOGLE_API_KEY, this.env.E2B_API_KEY);
        const result = await assetGen.generateImages(
          reqId, script, video.video_type, video.image_model, referenceImages
        );

        const r2 = new R2StorageService(this.env.ASSETS_BUCKET);

        // Delete existing slide_image and grid_image assets
        await this.env.DB.prepare(`
          DELETE FROM video_assets WHERE video_id = ? AND asset_type IN ('slide_image', 'grid_image', 'image_generation_prompt')
        `).bind(videoId).run();
        log.assetGenerationWorkflow.info(reqId, 'Deleted existing image assets', { videoId });

        // Upload individual slides
        for (const slide of result.slides) {
          const data = Uint8Array.from(atob(slide.base64), c => c.charCodeAt(0));
          const { key, size, publicUrl } = await r2.uploadAsset(slide.ulid, data.buffer, slide.mimeType);

          await this.env.DB.prepare(`
            INSERT INTO video_assets (video_id, asset_type, asset_index, r2_key, public_url, mime_type, file_size, metadata, generation_type)
            VALUES (?, 'slide_image', ?, ?, ?, ?, ?, ?, 'individual')
          `).bind(videoId, slide.metadata.slideIndex, key, publicUrl, slide.mimeType, size, JSON.stringify(slide.metadata)).run();

          log.assetGenerationWorkflow.info(reqId, `Slide image ${slide.metadata.slideIndex} uploaded`, {
            videoId,
            ulid: slide.ulid,
            key,
            size,
            publicUrl
          });
        }

        // Upload thumbnail (extracted from grid for pro model, or last slide for non-pro model)
        if (result.thumbnail) {
          const thumbnailUlid = ulid();
          const thumbnailData = Uint8Array.from(atob(result.thumbnail.base64), c => c.charCodeAt(0));
          const { key, size, publicUrl } = await r2.uploadAsset(thumbnailUlid, thumbnailData.buffer, result.thumbnail.mimeType);

          // Delete existing thumbnail_image assets
          await this.env.DB.prepare(`
            DELETE FROM video_assets WHERE video_id = ? AND asset_type = 'thumbnail_image'
          `).bind(videoId).run();

          // Store thumbnail asset
          await this.env.DB.prepare(`
            INSERT INTO video_assets (video_id, asset_type, asset_index, r2_key, public_url, mime_type, file_size, metadata)
            VALUES (?, 'thumbnail_image', 0, ?, ?, ?, ?, NULL)
          `).bind(videoId, key, publicUrl, result.thumbnail.mimeType, size).run();

          log.assetGenerationWorkflow.info(reqId, 'Thumbnail uploaded', {
            videoId,
            ulid: thumbnailUlid,
            key,
            size,
            source: video.image_model === 'gemini-3-pro-image-preview' ? 'grid' : 'last_slide'
          });
        }

        // Upload grids (if any - pro model only)
        for (const grid of result.grids) {
          const data = Uint8Array.from(atob(grid.base64), c => c.charCodeAt(0));
          const { key, size, publicUrl } = await r2.uploadAsset(grid.ulid, data.buffer, grid.mimeType);

          await this.env.DB.prepare(`
            INSERT INTO video_assets (video_id, asset_type, asset_index, r2_key, public_url, mime_type, file_size, metadata)
            VALUES (?, 'grid_image', ?, ?, ?, ?, ?, ?)
          `).bind(videoId, grid.metadata.gridIndex, key, publicUrl, grid.mimeType, size, JSON.stringify(grid.metadata)).run();

          log.assetGenerationWorkflow.info(reqId, `Grid ${grid.metadata.gridIndex} uploaded`, {
            videoId,
            ulid: grid.ulid,
            key,
            size,
            publicUrl
          });
        }

        // Return counts, prompts, and token usage for next steps
        return {
          gridCount: result.grids.length,
          prompts: result.prompts,
          tokenUsage: result.tokenUsage
        };
      });
      log.assetGenerationWorkflow.info(reqId, 'Step completed', { step: 'generate-images', gridCount });

      // Step 5: Store image generation prompts (pro model only)
      const promptCount = await step.do('store-prompts', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        // Only store prompts for pro model (grid generation)
        const isProModel = video.image_model === 'gemini-3-pro-image-preview';
        if (!isProModel || prompts.length === 0) {
          log.assetGenerationWorkflow.info(reqId, 'Skipping prompt storage (non-pro model or no prompts)', {
            isProModel,
            promptCount: prompts.length
          });
          return 0;
        }

        const r2 = new R2StorageService(this.env.ASSETS_BUCKET);
        const imageSize = video.video_type === 'short' ? '4K' : '4K'; // Pro model always uses 4K

        for (const promptData of prompts) {
          const promptUlid = ulid();
          const promptBytes = new TextEncoder().encode(promptData.prompt);
          const { key, size, publicUrl } = await r2.uploadAsset(promptUlid, promptBytes.buffer, 'text/plain');

          const metadata = JSON.stringify({
            gridIndex: promptData.gridIndex,
            model: video.image_model,
            resolution: imageSize
          });

          await this.env.DB.prepare(`
            INSERT INTO video_assets (video_id, asset_type, asset_index, r2_key, public_url, mime_type, file_size, metadata)
            VALUES (?, 'image_generation_prompt', ?, ?, ?, ?, ?, ?)
          `).bind(videoId, promptData.gridIndex, key, publicUrl, 'text/plain', size, metadata).run();

          log.assetGenerationWorkflow.info(reqId, `Image generation prompt stored`, {
            videoId,
            gridIndex: promptData.gridIndex,
            ulid: promptUlid,
            key,
            size,
            publicUrl
          });
        }

        return prompts.length;
      });
      log.assetGenerationWorkflow.info(reqId, 'Step completed', { step: 'store-prompts', promptCount });

      // Step 6: Collect ULIDs from uploaded assets
      const { gridImageAssetIds, slideImageAssetIds } = await step.do('collect-ulids', async () => {
        // Collect grid_image ULIDs
        const gridResult = await this.env.DB.prepare(`
          SELECT r2_key FROM video_assets
          WHERE video_id = ? AND asset_type = 'grid_image'
          ORDER BY asset_index
        `).bind(videoId).all<{ r2_key: string }>();

        const gridImageAssetIds = gridResult.results
          .map(row => {
            const match = row.r2_key.match(/^([0-9A-HJKMNP-TV-Z]{26})\./);
            return match ? match[1] : null;
          })
          .filter((id): id is string => id !== null);

        // Collect slide_image ULIDs
        const slideResult = await this.env.DB.prepare(`
          SELECT r2_key FROM video_assets
          WHERE video_id = ? AND asset_type = 'slide_image'
          ORDER BY asset_index
        `).bind(videoId).all<{ r2_key: string }>();

        const slideImageAssetIds = slideResult.results
          .map(row => {
            const match = row.r2_key.match(/^([0-9A-HJKMNP-TV-Z]{26})\./);
            return match ? match[1] : null;
          })
          .filter((id): id is string => id !== null);

        log.assetGenerationWorkflow.info(reqId, 'Collected ULIDs', {
          videoId,
          gridCount: gridImageAssetIds.length,
          slideCount: slideImageAssetIds.length
        });

        return { gridImageAssetIds, slideImageAssetIds };
      });

      // Step 7: Generate and upload audio for each slide
      // CRITICAL: Generate and upload each slide individually to avoid 1MiB step output limit
      const { audioCount, slideAudioAssetIds } = await step.do('generate-and-upload-audio', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '5 seconds',
          backoff: 'exponential'
        }
      }, async () => {
        const assetGen = new AssetGeneratorService(this.env.GOOGLE_API_KEY, this.env.E2B_API_KEY);
        const r2 = new R2StorageService(this.env.ASSETS_BUCKET);

        // DELETE existing slide_audio assets for this video to prevent duplicates
        await this.env.DB.prepare(`
          DELETE FROM video_assets WHERE video_id = ? AND asset_type = 'slide_audio'
        `).bind(videoId).run();
        log.assetGenerationWorkflow.info(reqId, 'Deleted existing audio assets', { videoId });

        let uploadedCount = 0;
        const audioULIDs: string[] = [];

        for (let i = 0; i < script.slides.length; i++) {
          const audio = await assetGen.generateSlideAudio(
            reqId,
            script.slides[i].audioNarration,
            ttsVoice,
            video.tts_model,
            script.slides[i].directorNotes,  // NEW: pass director notes from script
            script.slides[i].audioProfile    // NEW: pass audio profile from script
          );

          // Set the correct slideIndex in metadata
          audio.metadata.slideIndex = i;

          // Upload with ULID-based naming
          const data = Uint8Array.from(atob(audio.base64), c => c.charCodeAt(0));
          const { key, size, publicUrl } = await r2.uploadAsset(audio.ulid, data.buffer, audio.mimeType);

          await this.env.DB.prepare(`
            INSERT INTO video_assets (video_id, asset_type, asset_index, r2_key, public_url, mime_type, file_size, metadata)
            VALUES (?, 'slide_audio', ?, ?, ?, ?, ?, ?)
          `).bind(videoId, i, key, publicUrl, audio.mimeType, size, JSON.stringify(audio.metadata)).run();

          audioULIDs.push(audio.ulid);
          uploadedCount++;
          log.assetGenerationWorkflow.info(reqId, `Slide audio ${i} generated and uploaded`, { videoId, ulid: audio.ulid, key, size });
        }

        return { audioCount: uploadedCount, slideAudioAssetIds: audioULIDs };
      });
      log.assetGenerationWorkflow.info(reqId, 'Step completed', { step: 'generate-and-upload-audio', audioCount });

      // Step 8: Log costs
      await step.do('log-costs', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        // Log each generation separately with actual token usage
        for (let i = 0; i < tokenUsage.length; i++) {
          const tokens = tokenUsage[i];
          const isProModel = video.image_model === 'gemini-3-pro-image-preview';

          // For image generation, use estimated output tokens if API doesn't return them
          // Pro model (4K): ~2000 tokens per generation
          // Non-pro model (1K): ~1290 tokens per generation
          const outputTokens = tokens.outputTokens > 0
            ? tokens.outputTokens
            : (isProModel ? 2000 : 1290);

          // Calculate cost: image generation uses flat rate per generation
          // Pro model: $0.24 per grid (4K), non-pro $0.039 per slide (1K)
          const cost = isProModel ? 0.24 : 0.039;

          await this.env.DB.prepare(`
            INSERT INTO cost_logs (video_id, log_type, model_id, input_tokens, output_tokens, cost)
            VALUES (?, 'image-generation', ?, ?, ?, ?)
          `).bind(
            videoId,
            video.image_model,
            tokens.inputTokens,
            outputTokens,
            cost
          ).run();

          log.assetGenerationWorkflow.info(reqId, `Cost logged for generation ${i}`, {
            videoId,
            model: video.image_model,
            inputTokens: tokens.inputTokens,
            outputTokens,
            cost
          });
        }

        const totalImageCost = tokenUsage.length * (video.image_model === 'gemini-3-pro-image-preview' ? 0.24 : 0.039);
        log.assetGenerationWorkflow.info(reqId, 'All image generation costs logged', {
          generationCount: tokenUsage.length,
          totalImageCost
        });
      });

      // Step 9: Update status to 'generated' with ULID asset IDs
      await step.do('complete', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        // Update total_cost
        const totalCostResult = await this.env.DB.prepare(`
          SELECT SUM(cost) as total FROM cost_logs WHERE video_id = ?
        `).bind(videoId).first<{ total: number }>();

        const totalCost = totalCostResult?.total || 0;

        await this.env.DB.prepare(`
          UPDATE videos
          SET asset_status = 'generated',
              slide_image_asset_ids = ?,
              slide_audio_asset_ids = ?,
              total_cost = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(
          JSON.stringify(slideImageAssetIds),
          JSON.stringify(slideAudioAssetIds),
          totalCost,
          videoId
        ).run();

        log.assetGenerationWorkflow.info(reqId, 'Video status updated', {
          videoId,
          slideImageAssetIds,
          slideAudioAssetIds,
          totalCost
        });
      });

      // Step 10: Trigger video render workflow
      await step.do('trigger-video-render', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        const params = { videoId };
        await this.env.VIDEO_RENDER_WORKFLOW.create({
          id: `render-${videoId}-${Date.now()}`,
          params
        });
        log.assetGenerationWorkflow.info(reqId, 'Video render workflow triggered', { videoId });
      });

      log.assetGenerationWorkflow.info(reqId, 'Workflow completed', {
        durationMs: Date.now() - startTime,
        videoId,
        gridCount,
        slideCount: script.slides.length,
        promptCount
      });

      return {
        success: true,
        videoId,
        gridCount,
        slideCount: script.slides.length,
        promptCount
      };
    } catch (error) {
      log.assetGenerationWorkflow.error(reqId, 'Workflow failed', error as Error, { videoId });

      // Update video status to error
      try {
        await this.env.DB.prepare(`
          UPDATE videos
          SET asset_status = 'error', asset_error = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(error instanceof Error ? error.message : 'Unknown error', videoId).run();
      } catch (updateError) {
        log.assetGenerationWorkflow.error(reqId, 'Failed to update video status to error', updateError as Error);
      }

      return {
        success: false,
        videoId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
