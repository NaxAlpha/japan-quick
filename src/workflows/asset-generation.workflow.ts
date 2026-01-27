/**
 * AssetGenerationWorkflow - Generate grid images and slide audio using Gemini AI
 * Converts synchronous asset generation to asynchronous workflow
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { AssetGeneratorService } from '../services/asset-generator.js';
import { R2StorageService } from '../services/r2-storage.js';
import { fetchImagesAsBase64 } from '../lib/image-fetcher.js';
import type { Video, VideoScript, VideoAsset, TTSVoice } from '../types/video.js';
import type { Env } from '../types/news.js';
import { log, generateRequestId } from '../lib/logger.js';

export interface AssetGenerationParams {
  videoId: number;
}

export interface AssetGenerationResult {
  success: boolean;
  videoId?: number;
  gridCount?: number;
  slideCount?: number;
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
          limit: 3,
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
            const fetchedImages = await fetchImagesAsBase64(imageUrls, 3);

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

      // Step 4: Generate grid images
      const gridImages = await step.do('generate-grid-images', {
        retries: {
          limit: 3,
          delay: '5 seconds',
          backoff: 'exponential'
        }
      }, async () => {
        const assetGen = new AssetGeneratorService(this.env.GOOGLE_API_KEY);
        return await assetGen.generateGridImages(
          reqId, script, video.video_type, video.image_model, referenceImages
        );
      });
      log.assetGenerationWorkflow.info(reqId, 'Step completed', { step: 'generate-grid-images', gridCount: gridImages.length });

      // Step 5: Upload grids to R2
      await step.do('upload-grids', {
        retries: {
          limit: 3,
          delay: '3 seconds',
          backoff: 'exponential'
        }
      }, async () => {
        const r2 = new R2StorageService(this.env.ASSETS_BUCKET);

        for (let i = 0; i < gridImages.length; i++) {
          const img = gridImages[i];
          const data = Uint8Array.from(atob(img.base64), c => c.charCodeAt(0));
          const { key, size } = await r2.uploadAsset(videoId, 'grid_image', i, data.buffer, img.mimeType);

          await this.env.DB.prepare(`
            INSERT INTO video_assets (video_id, asset_type, asset_index, r2_key, mime_type, file_size, metadata)
            VALUES (?, 'grid_image', ?, ?, ?, ?, ?)
          `).bind(videoId, i, key, img.mimeType, size, JSON.stringify(img.metadata)).run();

          log.assetGenerationWorkflow.info(reqId, `Grid ${i} uploaded`, { videoId, key, size });
        }
      });

      // Step 6: Generate audio for each slide
      const slideAudioResults = await step.do('generate-audio', {
        retries: {
          limit: 3,
          delay: '5 seconds',
          backoff: 'exponential'
        }
      }, async () => {
        const assetGen = new AssetGeneratorService(this.env.GOOGLE_API_KEY);
        const results = [];

        for (let i = 0; i < script.slides.length; i++) {
          const audio = await assetGen.generateSlideAudio(
            reqId, script.slides[i].audioNarration, ttsVoice, video.tts_model
          );

          // Set the correct slideIndex in metadata
          audio.metadata.slideIndex = i;

          results.push({ index: i, audio });
        }

        return results;
      });
      log.assetGenerationWorkflow.info(reqId, 'Step completed', { step: 'generate-audio', audioCount: slideAudioResults.length });

      // Step 7: Upload audio to R2
      await step.do('upload-audio', {
        retries: {
          limit: 3,
          delay: '3 seconds',
          backoff: 'exponential'
        }
      }, async () => {
        const r2 = new R2StorageService(this.env.ASSETS_BUCKET);

        for (const { index, audio } of slideAudioResults) {
          const data = Uint8Array.from(atob(audio.base64), c => c.charCodeAt(0));
          const { key, size } = await r2.uploadAsset(videoId, 'slide_audio', index, data.buffer, audio.mimeType);

          await this.env.DB.prepare(`
            INSERT INTO video_assets (video_id, asset_type, asset_index, r2_key, mime_type, file_size, metadata)
            VALUES (?, 'slide_audio', ?, ?, ?, ?, ?)
          `).bind(videoId, index, key, audio.mimeType, size, JSON.stringify(audio.metadata)).run();

          log.assetGenerationWorkflow.info(reqId, `Slide audio ${index} uploaded`, { videoId, key, size });
        }
      });

      // Step 8: Log costs
      await step.do('log-costs', {
        retries: {
          limit: 3,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        const gridCount = gridImages.length;
        const imageCost = gridCount * (video.image_model === 'gemini-2.5-flash-image' ? 0.039 : 0.134);

        await this.env.DB.prepare(`
          INSERT INTO cost_logs (video_id, log_type, model_id, input_tokens, output_tokens, cost)
          VALUES (?, 'image-generation', ?, 0, 0, ?)
        `).bind(videoId, video.image_model, imageCost).run();

        log.assetGenerationWorkflow.info(reqId, 'Costs logged', { imageCost });
      });

      // Step 9: Update status to 'generated'
      await step.do('complete', {
        retries: {
          limit: 3,
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
          SET asset_status = 'generated', total_cost = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(totalCost, videoId).run();
      });

      log.assetGenerationWorkflow.info(reqId, 'Workflow completed', {
        durationMs: Date.now() - startTime,
        videoId,
        gridCount: gridImages.length,
        slideCount: script.slides.length
      });

      return {
        success: true,
        videoId,
        gridCount: gridImages.length,
        slideCount: script.slides.length
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
