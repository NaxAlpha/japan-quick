/**
 * ScriptGenerationWorkflow - Generate video scripts using Gemini AI
 * Converts synchronous script generation to asynchronous workflow
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { ulid } from 'ulid';
import { GeminiService } from '../services/gemini.js';
import { PolicyCheckerService } from '../services/policy-checker.js';
import { R2StorageService } from '../services/r2-storage.js';
import type { Video, VideoScript, VideoFormat, UrgencyLevel } from '../types/video.js';
import type { Article, ArticleVersion, ArticleComment } from '../types/article.js';
import type { Env } from '../types/env.js';
import { log, generateRequestId } from '../lib/logger.js';
import { RETRY_POLICIES } from '../lib/constants.js';
import { persistPolicyCheck } from '../lib/policy-persistence.js';

/**
 * Get time context from current hour in JST
 */
function getTimeContextFromJST(): string | undefined {
  // Get current time in JST (UTC+9)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const jst = new Date(utc + (9 * 3600000));
  const hour = jst.getHours();

  // Define time slots
  if (hour >= 6 && hour < 9) return 'morning';
  if (hour >= 12 && hour < 14) return 'lunch';
  if (hour >= 18 && hour < 21) return 'evening';
  return undefined; // No specific time context
}

export interface ScriptGenerationParams {
  videoId: number;
}

export interface ScriptGenerationResult {
  success: boolean;
  videoId?: number;
  slideCount?: number;
  error?: string;
}

export class ScriptGenerationWorkflow extends WorkflowEntrypoint<Env['Bindings'], ScriptGenerationParams, ScriptGenerationResult> {
  async run(event: WorkflowEvent<ScriptGenerationParams>, step: WorkflowStep): Promise<ScriptGenerationResult> {
    const reqId = generateRequestId();
    const workflowId = event.id;
    const { videoId } = event.payload;
    const startTime = Date.now();
    log.scriptGenerationWorkflow.info(reqId, 'Workflow started', { workflowId, videoId });

    try {
      // Step 1: Fetch video data
      const video = await step.do('fetch-video-data', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        const result = await this.env.DB.prepare(`
          SELECT
            id,
            video_type,
            video_format,
            urgency,
            articles,
            script_status
          FROM videos
          WHERE id = ?
        `).bind(videoId).first();

        if (!result) {
          throw new Error(`Video ${videoId} not found`);
        }

        return result as Video & { video_format: VideoFormat | null; urgency: UrgencyLevel | null };
      });
      log.scriptGenerationWorkflow.info(reqId, 'Step completed', { step: 'fetch-video-data', durationMs: Date.now() - startTime });

      // Validate video can generate script
      if (video.script_status === 'generating') {
        throw new Error('Script generation already in progress');
      }

      const articlePickIds = video.articles ? JSON.parse(video.articles) : [];
      if (articlePickIds.length === 0) {
        throw new Error('No articles selected for this video');
      }

      // Step 2: Set script_status = 'generating'
      await step.do('update-status-generating', async () => {
        await this.env.DB.prepare(`
          UPDATE videos
          SET script_status = 'generating', script_error = NULL, updated_at = datetime('now')
          WHERE id = ?
        `).bind(videoId).run();
      });
      log.scriptGenerationWorkflow.info(reqId, 'Step completed', { step: 'update-status-generating' });

      // Step 3: Fetch article content, comments, images
      const articlesWithContent = await step.do('fetch-article-data', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        const results = [];

        for (const pickId of articlePickIds) {
          // Fetch article
          const article = await this.env.DB.prepare(`
            SELECT * FROM articles WHERE pick_id = ?
          `).bind(pickId).first<Article>();

          if (!article) {
            log.scriptGenerationWorkflow.warn(reqId, 'Article not found', { pickId });
            continue;
          }

          // Fetch latest version
          const version = await this.env.DB.prepare(`
            SELECT * FROM article_versions
            WHERE article_id = ?
            ORDER BY version DESC
            LIMIT 1
          `).bind(article.id).first<ArticleVersion>();

          if (!version) {
            log.scriptGenerationWorkflow.warn(reqId, 'No article version found', { pickId, articleId: article.id });
            continue;
          }

          // Fetch comments
          const commentsResult = await this.env.DB.prepare(`
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

          results.push({
            pickId: article.pickId || (article as unknown as { pick_id?: string }).pick_id || pickId,
            title: article.title || 'Untitled',
            content: version.content,
            contentText: version.contentText,
            comments,
            images
          });
        }

        return results;
      });
      log.scriptGenerationWorkflow.info(reqId, 'Step completed', { step: 'fetch-article-data', articleCount: articlesWithContent.length });

      if (articlesWithContent.length === 0) {
        throw new Error('No article content available');
      }

      // Step 4: Generate script using Gemini AI
      const timeContext = getTimeContextFromJST();
      const hasEnhancedMetadata = video.video_format && video.urgency;

      const generationResult = await step.do('generate-script', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '5 seconds',
          backoff: 'exponential'
        }
      }, async () => {
        const geminiService = new GeminiService(this.env.GOOGLE_API_KEY);

        // Use enhanced function if metadata is available
        if (hasEnhancedMetadata && video.video_format && video.urgency) {
          log.scriptGenerationWorkflow.info(reqId, 'Using enhanced script generation', {
            videoFormat: video.video_format,
            urgency: video.urgency,
            timeContext
          });
          return await geminiService.generateScriptEnhanced(reqId, {
            videoFormat: video.video_format,
            urgency: video.urgency,
            timeContext,
            articles: articlesWithContent
          });
        }

        // Fall back to basic function for backward compatibility
        log.scriptGenerationWorkflow.info(reqId, 'Using basic script generation (no enhanced metadata)');
        return await geminiService.generateScript(reqId, {
          videoType: video.video_type,
          articles: articlesWithContent
        });
      });
      log.scriptGenerationWorkflow.info(reqId, 'Step completed', { step: 'generate-script', slideCount: generationResult.script.slides.length });

      // Step 4.5: Store script prompt to R2 and database if using enhanced generation
      if (hasEnhancedMetadata && 'prompt' in generationResult) {
        const enhancedResult = generationResult as { prompt: string };
        if (enhancedResult.prompt) {
          await step.do('store-script-prompt', {
            retries: {
              limit: RETRY_POLICIES.DEFAULT.limit,
              delay: '2 seconds',
              backoff: 'constant'
            }
          }, async () => {
            // Generate ULID for prompt file
            const promptUlid = ulid();

            // Convert prompt to buffer (Uint8Array, not ArrayBuffer)
            const promptBuffer = new TextEncoder().encode(enhancedResult.prompt);

            // Upload to R2 - match video-selection.workflow pattern exactly
            const r2 = new R2StorageService(this.env.ASSETS_BUCKET, this.env.ASSETS_PUBLIC_URL);
            const uploadResult = await r2.uploadAsset(promptUlid, promptBuffer, 'text/plain; charset=utf-8');

            // Create database record
            await this.env.DB.prepare(`
              INSERT INTO script_prompts (video_id, prompt, r2_key, public_url)
              VALUES (?, ?, ?, ?)
            `).bind(videoId, enhancedResult.prompt, uploadResult.key, uploadResult.publicUrl).run();

            log.scriptGenerationWorkflow.info(reqId, 'Script prompt stored to database', {
              promptUlid,
              fileSize: uploadResult.size,
              publicUrl: uploadResult.publicUrl
            });
          });
          log.scriptGenerationWorkflow.info(reqId, 'Step completed', { step: 'store-script-prompt' });
        }
      }

      // Step 5: Log token costs
      const costData = await step.do('log-cost', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        const { inputTokens, outputTokens } = generationResult.tokenUsage;
        // Use Pro model pricing when enhanced generation was used
        const modelId = hasEnhancedMetadata ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
        const inputCostPerMillion = hasEnhancedMetadata ? 2.00 : 0.50;
        const outputCostPerMillion = hasEnhancedMetadata ? 12.00 : 3.00;
        const cost = (inputTokens / 1_000_000) * inputCostPerMillion +
                     (outputTokens / 1_000_000) * outputCostPerMillion;

        await this.env.DB.prepare(`
          INSERT INTO cost_logs (video_id, log_type, model_id, attempt_id, input_tokens, output_tokens, cost)
          VALUES (?, 'script-generation', ?, 1, ?, ?, ?)
        `).bind(videoId, modelId, inputTokens, outputTokens, cost).run();

        return { inputTokens, outputTokens, cost };
      });
      log.scriptGenerationWorkflow.info(reqId, 'Step completed', { step: 'log-cost', cost: costData.cost });

      // Step 6: Save script to database
      await step.do('save-script', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        const scriptJson = JSON.stringify(generationResult.script);
        await this.env.DB.prepare(`
          UPDATE videos
          SET script = ?, script_status = 'generated', updated_at = datetime('now')
          WHERE id = ?
        `).bind(scriptJson, videoId).run();
      });
      log.scriptGenerationWorkflow.info(reqId, 'Step completed', { step: 'save-script' });

      // Step 7: Run light script policy check and persist result
      const scriptPolicy = await step.do('run-script-policy-check', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '3 seconds',
          backoff: 'constant'
        }
      }, async () => {
        const policyChecker = new PolicyCheckerService(
          this.env.GOOGLE_API_KEY,
          this.env.ASSETS_BUCKET,
          this.env.ASSETS_PUBLIC_URL
        );

        const policyResult = await policyChecker.runScriptLightCheck(reqId, {
          videoId,
          script: generationResult.script,
          articles: articlesWithContent.map((article) => ({
            pickId: article.pickId,
            title: article.title,
            content: article.content,
            contentText: article.contentText
          }))
        });

        const persisted = await persistPolicyCheck(this.env.DB, {
          videoId,
          result: policyResult
        });

        return {
          stageStatus: persisted.stageStatus,
          overallStatus: persisted.overallStatus,
          policyRunId: persisted.policyRunId,
          cost: persisted.cost,
          blockReasons: persisted.blockReasons
        };
      });
      log.scriptGenerationWorkflow.info(reqId, 'Step completed', {
        step: 'run-script-policy-check',
        stageStatus: scriptPolicy.stageStatus,
        overallStatus: scriptPolicy.overallStatus,
        policyRunId: scriptPolicy.policyRunId,
        cost: scriptPolicy.cost
      });

      // Step 8: Update total_cost
      await step.do('update-total-cost', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        const totalCostResult = await this.env.DB.prepare(`
          SELECT SUM(cost) as total FROM cost_logs WHERE video_id = ?
        `).bind(videoId).first<{ total: number }>();

        const totalCost = totalCostResult?.total || 0;

        await this.env.DB.prepare(`
          UPDATE videos SET total_cost = ? WHERE id = ?
        `).bind(totalCost, videoId).run();
      });

      // Step 9: Trigger asset generation workflow unless policy is blocking
      await step.do('trigger-asset-generation', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        if (scriptPolicy.overallStatus === 'BLOCK') {
          const blockReason = scriptPolicy.blockReasons.length > 0
            ? scriptPolicy.blockReasons.join(' | ')
            : 'Script policy check returned BLOCK';

          await this.env.DB.prepare(`
            UPDATE videos
            SET asset_status = 'pending',
                asset_error = ?,
                updated_at = datetime('now')
            WHERE id = ?
          `).bind(`Policy blocked asset generation: ${blockReason}`, videoId).run();

          log.scriptGenerationWorkflow.warn(reqId, 'Asset generation skipped due to policy BLOCK', {
            videoId,
            blockReason
          });
          return;
        }

        await this.env.DB.prepare(`
          UPDATE videos
          SET asset_error = NULL,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(videoId).run();

        const params = { videoId };
        await this.env.ASSET_GENERATION_WORKFLOW.create({
          id: `asset-gen-${videoId}-${Date.now()}`,
          params
        });
        log.scriptGenerationWorkflow.info(reqId, 'Asset generation workflow triggered', { videoId });
      });

      log.scriptGenerationWorkflow.info(reqId, 'Workflow completed', {
        durationMs: Date.now() - startTime,
        videoId,
        slideCount: generationResult.script.slides.length
      });

      return {
        success: true,
        videoId,
        slideCount: generationResult.script.slides.length
      };
    } catch (error) {
      log.scriptGenerationWorkflow.error(reqId, 'Workflow failed', error as Error, { videoId });

      // Update video status to error
      try {
        await this.env.DB.prepare(`
          UPDATE videos
          SET script_status = 'error', script_error = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(error instanceof Error ? error.message : 'Unknown error', videoId).run();
      } catch (updateError) {
        log.scriptGenerationWorkflow.error(reqId, 'Failed to update video status to error', updateError as Error);
      }

      return {
        success: false,
        videoId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
