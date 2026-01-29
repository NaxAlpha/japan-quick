/**
 * ScriptGenerationWorkflow - Generate video scripts using Gemini AI
 * Converts synchronous script generation to asynchronous workflow
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { GeminiService } from '../services/gemini.js';
import type { Video, VideoScript } from '../types/video.js';
import type { Article, ArticleVersion, ArticleComment } from '../types/article.js';
import type { Env } from '../types/env.js';
import { log, generateRequestId } from '../lib/logger.js';
import { RETRY_POLICIES, SCRAPING, VIDEO_RENDERING } from '../lib/constants.js';

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
            articles,
            script_status
          FROM videos
          WHERE id = ?
        `).bind(videoId).first();

        if (!result) {
          throw new Error(`Video ${videoId} not found`);
        }

        return result as Video;
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
            pickId: article.pickId,
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
      const generationResult = await step.do('generate-script', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '5 seconds',
          backoff: 'exponential'
        }
      }, async () => {
        const geminiService = new GeminiService(this.env.GOOGLE_API_KEY);
        return await geminiService.generateScript(reqId, {
          videoType: video.video_type,
          articles: articlesWithContent
        });
      });
      log.scriptGenerationWorkflow.info(reqId, 'Step completed', { step: 'generate-script', slideCount: generationResult.script.slides.length });

      // Step 5: Log token costs
      const costData = await step.do('log-cost', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: '2 seconds',
          backoff: 'constant'
        }
      }, async () => {
        const { inputTokens, outputTokens } = generationResult.tokenUsage;
        const modelId = 'gemini-3-flash-preview';
        const inputCostPerMillion = 0.50;
        const outputCostPerMillion = 3.00;
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

      // Step 7: Update total_cost
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
