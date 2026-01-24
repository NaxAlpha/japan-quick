/**
 * VideoSelectionWorkflow - AI-powered article selection for video generation
 * Runs every 30 min, fetches recently scraped articles, uses Gemini to select most important ones
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { GeminiService } from '../services/gemini.js';
import type { Article } from '../types/article.js';
import type { Video } from '../types/video.js';
import type { Env } from '../types/news.js';
import { log, generateRequestId } from '../lib/logger.js';

export interface VideoSelectionParams {
  // Empty - cron triggered
}

export interface VideoSelectionResult {
  success: boolean;
  videoId?: number;
  articlesProcessed?: number;
  error?: string;
}

export class VideoSelectionWorkflow extends WorkflowEntrypoint<Env['Bindings'], VideoSelectionParams, VideoSelectionResult> {
  async run(event: WorkflowEvent<VideoSelectionParams>, step: WorkflowStep): Promise<VideoSelectionResult> {
    const reqId = generateRequestId();
    const workflowId = event.id;
    const startTime = Date.now();
    log.videoSelectionWorkflow.info(reqId, 'Workflow started', { workflowId });
    let videoId: number | null = null;

    try {
      // Step 1: Fetch eligible articles
      const fetchStart = Date.now();
      const articles = await step.do('fetch-eligible-articles', {
        retries: {
          limit: 3,
          delay: "2 seconds",
          backoff: "constant"
        }
      }, async () => {
        const result = await this.env.DB.prepare(`
          SELECT
            id,
            pick_id as pickId,
            article_id as articleId,
            article_url as articleUrl,
            status,
            title,
            source,
            thumbnail_url as thumbnailUrl,
            published_at as publishedAt,
            modified_at as modifiedAt,
            detected_at as detectedAt,
            first_scraped_at as firstScrapedAt,
            second_scraped_at as secondScrapedAt,
            scheduled_rescrape_at as scheduledRescrapeAt,
            created_at as createdAt,
            updated_at as updatedAt
          FROM articles
          WHERE status = 'scraped_v2'
            AND second_scraped_at IS NOT NULL
            AND datetime(second_scraped_at) >= datetime('now', '-24 hours')
            AND pick_id NOT IN (
              SELECT json_each.value FROM videos, json_each(videos.articles)
              WHERE videos.articles IS NOT NULL
            )
          ORDER BY second_scraped_at DESC
        `).all();

        return result.results as Article[];
      });
      log.videoSelectionWorkflow.info(reqId, 'Step completed', { step: 'fetch-eligible-articles', durationMs: Date.now() - fetchStart, articleCount: articles.length });

      if (articles.length === 0) {
        log.videoSelectionWorkflow.info(reqId, 'Workflow completed (no eligible articles)', { durationMs: Date.now() - startTime });
        return {
          success: true,
          articlesProcessed: 0
        };
      }

      // Step 2: Create video entry with status 'doing'
      const createStart = Date.now();
      videoId = await step.do('create-video-entry', {
        retries: {
          limit: 3,
          delay: "2 seconds",
          backoff: "constant"
        }
      }, async () => {
        const result = await this.env.DB.prepare(`
          INSERT INTO videos (video_type, selection_status)
          VALUES ('short', 'doing')
          RETURNING id
        `).first<{ id: number }>();

        if (!result) {
          throw new Error('Failed to create video entry');
        }

        return result.id;
      });
      log.videoSelectionWorkflow.info(reqId, 'Step completed', { step: 'create-video-entry', durationMs: Date.now() - createStart, videoId });

      // Step 3: Call Gemini AI
      const geminiStart = Date.now();
      const selectionResult = await step.do('call-gemini-ai', {
        retries: {
          limit: 3,
          delay: "5 seconds",
          backoff: "exponential"
        }
      }, async () => {
        const geminiService = new GeminiService(this.env.GOOGLE_API_KEY);
        return await geminiService.selectArticles(reqId, articles);
      });
      log.videoSelectionWorkflow.info(reqId, 'Step completed', { step: 'call-gemini-ai', durationMs: Date.now() - geminiStart, selectedArticleCount: selectionResult.articles.length, inputTokens: selectionResult.tokenUsage.inputTokens, outputTokens: selectionResult.tokenUsage.outputTokens });

      // Step 4: Log cost
      const costStart = Date.now();
      const costData = await step.do('log-cost', {
        retries: {
          limit: 3,
          delay: "2 seconds",
          backoff: "constant"
        }
      }, async () => {
        const { inputTokens, outputTokens } = selectionResult.tokenUsage;

        // Calculate cost based on model pricing
        // Gemini 3 Flash: $0.50 per 1M input tokens, $3.00 per 1M output tokens
        const inputCost = (inputTokens / 1_000_000) * 0.50;
        const outputCost = (outputTokens / 1_000_000) * 3.00;
        const totalCost = inputCost + outputCost;

        await this.env.DB.prepare(`
          INSERT INTO cost_logs (video_id, log_type, model_id, attempt_id, input_tokens, output_tokens, cost)
          VALUES (?, 'video-selection', 'gemini-3-flash-preview', 1, ?, ?, ?)
        `).bind(videoId, inputTokens, outputTokens, totalCost).run();

        return { inputTokens, outputTokens, totalCost };
      });
      log.videoSelectionWorkflow.info(reqId, 'Step completed', { step: 'log-cost', durationMs: Date.now() - costStart, cost: costData.totalCost });

      // Step 5: Update video entry with AI results
      const updateStart = Date.now();
      await step.do('update-video-entry', {
        retries: {
          limit: 3,
          delay: "2 seconds",
          backoff: "constant"
        }
      }, async () => {
        // Calculate total cost from cost_logs
        const costResult = await this.env.DB.prepare(`
          SELECT SUM(cost) as total_cost FROM cost_logs WHERE video_id = ?
        `).bind(videoId).first<{ total_cost: number }>();

        const totalCost = costResult?.total_cost || 0;

        // Update video with AI results
        await this.env.DB.prepare(`
          UPDATE videos
          SET notes = ?,
              short_title = ?,
              articles = ?,
              video_type = ?,
              selection_status = 'todo',
              total_cost = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(
          selectionResult.notes,
          selectionResult.shortTitle,
          JSON.stringify(selectionResult.articles),
          selectionResult.videoType,
          totalCost,
          videoId
        ).run();
      });
      log.videoSelectionWorkflow.info(reqId, 'Step completed', { step: 'update-video-entry', durationMs: Date.now() - updateStart });

      log.videoSelectionWorkflow.info(reqId, 'Workflow completed', { durationMs: Date.now() - startTime, videoId, articlesProcessed: articles.length, selectedArticles: selectionResult.articles.length });

      return {
        success: true,
        videoId,
        articlesProcessed: articles.length
      };
    } catch (error) {
      log.videoSelectionWorkflow.error(reqId, 'Workflow failed', error as Error);

      // If we created a video entry, update its status to error
      if (videoId !== null) {
        try {
          await this.env.DB.prepare(`
            UPDATE videos SET selection_status = 'error', notes = ? WHERE id = ?
          `).bind(error instanceof Error ? error.message : 'Unknown error', videoId).run();
          log.videoSelectionWorkflow.info(reqId, 'Video entry updated to error status', { videoId });
        } catch (updateError) {
          log.videoSelectionWorkflow.error(reqId, 'Failed to update video status to error', updateError as Error);
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
