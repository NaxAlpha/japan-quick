/**
 * VideoSelectionWorkflow - AI-powered article selection for video generation
 * Runs on odd JST hours, fetches recently scraped articles, uses Gemini to select most important ones
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { GeminiService } from '../services/gemini.js';
import { R2StorageService } from '../services/r2-storage.js';
import type { AIArticleInputWithContent, PastVideoContext, SelectionFormatCounts, SelectionSchedulingContext } from '../types/video.js';
import type { Env } from '../types/env.js';
import { log, generateRequestId } from '../lib/logger.js';
import { RETRY_POLICIES } from '../lib/constants.js';
import { ARTICLE_LOOKBACK_HOURS, PAST_VIDEO_LOOKBACK_HOURS, SOFT_DAILY_TOTAL, calculateRemainingTargets, getJstDayWindow } from '../lib/video-selection-policy.js';
import { ulid } from 'ulid';

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
      // Step 1: Fetch eligible articles (both v1 and v2) with content
      const fetchStart = Date.now();
      const articles = await step.do('fetch-eligible-articles', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: RETRY_POLICIES.DEFAULT.delay,
          backoff: RETRY_POLICIES.DEFAULT.backoff
        }
      }, async () => {
        const result = await this.env.DB.prepare(`
          SELECT
            a.pick_id as "index",
            a.title,
            a.published_at as dateTime,
            a.source,
            a.status,
            av.content,
            LENGTH(av.content_text) as contentLength
          FROM articles a
          JOIN article_versions av ON a.id = av.article_id
          WHERE (a.status = 'scraped_v1' OR a.status = 'scraped_v2')
            AND (
              (a.status = 'scraped_v1' AND av.version = 1 AND datetime(a.first_scraped_at) >= datetime('now', '-${ARTICLE_LOOKBACK_HOURS} hours'))
              OR
              (a.status = 'scraped_v2' AND av.version = 2 AND datetime(a.second_scraped_at) >= datetime('now', '-${ARTICLE_LOOKBACK_HOURS} hours'))
            )
            AND a.pick_id NOT IN (
              SELECT json_each.value FROM videos, json_each(videos.articles)
              WHERE videos.articles IS NOT NULL
            )
          ORDER BY
            CASE WHEN a.status = 'scraped_v2' THEN a.second_scraped_at ELSE a.first_scraped_at END DESC
        `).all();

        return result.results as AIArticleInputWithContent[];
      });
      log.videoSelectionWorkflow.info(reqId, 'Step completed', { step: 'fetch-eligible-articles', durationMs: Date.now() - fetchStart, articleCount: articles.length });

      if (articles.length === 0) {
        log.videoSelectionWorkflow.info(reqId, 'Workflow completed (no eligible articles)', { durationMs: Date.now() - startTime });
        return {
          success: true,
          articlesProcessed: 0
        };
      }

      // Step 2: Fetch past videos from last 36 hours
      const fetchPastStart = Date.now();
      const pastVideos = await step.do('fetch-past-videos', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: RETRY_POLICIES.DEFAULT.delay,
          backoff: RETRY_POLICIES.DEFAULT.backoff
        }
      }, async () => {
        const result = await this.env.DB.prepare(`
          SELECT
            v.id,
            v.short_title as title,
            v.articles,
            v.video_type as videoType,
            v.video_format as videoFormat,
            v.created_at as createdAt,
            GROUP_CONCAT(a.title, '|') as articleTitles
          FROM videos v
          LEFT JOIN json_each(v.articles) je
          LEFT JOIN articles a ON a.pick_id = je.value
          WHERE datetime(v.created_at) >= datetime('now', '-${PAST_VIDEO_LOOKBACK_HOURS} hours')
          GROUP BY v.id
          ORDER BY v.created_at DESC
        `).all();

        return (result.results as any[]).map(row => ({
          id: row.id,
          title: row.title || '',
          articles: row.articleTitles ? row.articleTitles.split('|') : [],
          videoType: row.videoType || 'short',
          videoFormat: row.videoFormat || 'single_short',
          createdAt: row.createdAt
        })) as PastVideoContext[];
      });
      log.videoSelectionWorkflow.info(reqId, 'Step completed', { step: 'fetch-past-videos', durationMs: Date.now() - fetchPastStart, pastVideoCount: pastVideos.length });

      // Step 3: Calculate scheduling context (soft targets, no hard cap)
      const schedulingStart = Date.now();
      const schedulingContext: SelectionSchedulingContext = await step.do('calculate-scheduling-context', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: RETRY_POLICIES.DEFAULT.delay,
          backoff: RETRY_POLICIES.DEFAULT.backoff
        }
      }, async () => {
        const now = new Date();
        const { currentTimeJST, dayStart, dayEndExclusive } = getJstDayWindow(now);

        const countResult = await this.env.DB.prepare(`
          SELECT COUNT(*) as count
          FROM videos
          WHERE datetime(created_at, '+9 hours') >= datetime(?)
            AND datetime(created_at, '+9 hours') < datetime(?)
        `).bind(dayStart, dayEndExclusive).first<{ count: number }>();

        const videosCreatedToday = countResult?.count || 0;
        const totalDailyTarget = SOFT_DAILY_TOTAL;

        // Query videos by format created today
        const formatCountResult = await this.env.DB.prepare(`
          SELECT
            CASE
              WHEN video_format IS NOT NULL THEN video_format
              WHEN video_type = 'long' THEN 'long'
              ELSE 'single_short'
            END as effective_video_format,
            COUNT(*) as count
          FROM videos
          WHERE datetime(created_at, '+9 hours') >= datetime(?)
            AND datetime(created_at, '+9 hours') < datetime(?)
          GROUP BY effective_video_format
        `).bind(dayStart, dayEndExclusive).all();

        const formatsToday: SelectionFormatCounts = { single_short: 0, multi_short: 0, long: 0 };
        for (const row of formatCountResult.results as any[]) {
          if (row.effective_video_format in formatsToday) {
            formatsToday[row.effective_video_format as keyof SelectionFormatCounts] = row.count;
          }
        }

        return {
          currentTimeJST,
          videosCreatedToday,
          totalDailyTarget,
          formatsToday,
          remainingTargets: calculateRemainingTargets(formatsToday)
        };
      });
      log.videoSelectionWorkflow.info(reqId, 'Step completed', {
        step: 'calculate-scheduling-context',
        durationMs: Date.now() - schedulingStart,
        videosCreatedToday: schedulingContext.videosCreatedToday,
        softTargetRemaining: schedulingContext.totalDailyTarget - schedulingContext.videosCreatedToday,
        formatsToday: JSON.stringify(schedulingContext.formatsToday),
        remainingTargets: JSON.stringify(schedulingContext.remainingTargets)
      });

      // Step 4: Create video entry with status 'doing'
      const createStart = Date.now();
      videoId = await step.do('create-video-entry', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: RETRY_POLICIES.DEFAULT.delay,
          backoff: RETRY_POLICIES.DEFAULT.backoff
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

      // Step 5: Call Gemini AI with enhanced selection
      const geminiStart = Date.now();
      const selectionResult = await step.do('call-gemini-ai-enhanced', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: RETRY_POLICIES.AI_CALL.delay,
          backoff: RETRY_POLICIES.AI_CALL.backoff
        }
      }, async () => {
        const geminiService = new GeminiService(this.env.GOOGLE_API_KEY);
        return await geminiService.selectArticlesEnhanced(reqId, articles, pastVideos, schedulingContext);
      });
      log.videoSelectionWorkflow.info(reqId, 'Step completed', {
        step: 'call-gemini-ai-enhanced',
        durationMs: Date.now() - geminiStart,
        selectedArticleCount: selectionResult.articles.length,
        videoFormat: selectionResult.videoFormat,
        urgency: selectionResult.urgency,
        inputTokens: selectionResult.tokenUsage.inputTokens,
        outputTokens: selectionResult.tokenUsage.outputTokens
      });

      // Step 6: Save selection prompt to R2
      const promptStart = Date.now();
      await step.do('save-selection-prompt', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: RETRY_POLICIES.DEFAULT.delay,
          backoff: RETRY_POLICIES.DEFAULT.backoff
        }
      }, async () => {
        // Generate ULID for prompt file
        const promptUlid = ulid();

        // Convert prompt to buffer
        const promptBuffer = new TextEncoder().encode(selectionResult.prompt);

        // Upload to R2
        const r2 = new R2StorageService(this.env.ASSETS_BUCKET, this.env.ASSETS_PUBLIC_URL);
        const uploadResult = await r2.uploadAsset(promptUlid, promptBuffer, 'text/plain; charset=utf-8');

        // Create video_assets record
        await this.env.DB.prepare(`
          INSERT INTO video_assets (
            video_id, asset_type, asset_index, r2_key,
            public_url, mime_type, file_size, generation_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          videoId,
          'selection_prompt',
          0,
          uploadResult.key,
          uploadResult.publicUrl,
          'text/plain; charset=utf-8',
          uploadResult.size,
          'individual'
        ).run();

        log.videoSelectionWorkflow.info(reqId, 'Selection prompt saved', {
          promptUlid,
          fileSize: uploadResult.size,
          publicUrl: uploadResult.publicUrl
        });
      });
      log.videoSelectionWorkflow.info(reqId, 'Step completed', { step: 'save-selection-prompt', durationMs: Date.now() - promptStart });

      // Step 7: Log cost
      const costStart = Date.now();
      const costData = await step.do('log-cost', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: RETRY_POLICIES.DEFAULT.delay,
          backoff: RETRY_POLICIES.DEFAULT.backoff
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

      // Step 8: Update video entry with AI results
      const updateStart = Date.now();
      await step.do('update-video-entry', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: RETRY_POLICIES.DEFAULT.delay,
          backoff: RETRY_POLICIES.DEFAULT.backoff
        }
      }, async () => {
        // Calculate total cost from cost_logs
        const costResult = await this.env.DB.prepare(`
          SELECT SUM(cost) as total_cost FROM cost_logs WHERE video_id = ?
        `).bind(videoId).first<{ total_cost: number }>();

        const totalCost = costResult?.total_cost || 0;

        // Determine video_type from video_format
        const videoType = selectionResult.videoFormat === 'long' ? 'long' : 'short';

        // Update video with AI results including new fields
        await this.env.DB.prepare(`
          UPDATE videos
          SET notes = ?,
              short_title = ?,
              articles = ?,
              video_type = ?,
              video_format = ?,
              urgency = ?,
              selection_status = 'todo',
              total_cost = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(
          selectionResult.notes,
          selectionResult.shortTitle,
          JSON.stringify(selectionResult.articles),
          videoType,
          selectionResult.videoFormat,
          selectionResult.urgency,
          totalCost,
          videoId
        ).run();
      });
      log.videoSelectionWorkflow.info(reqId, 'Step completed', { step: 'update-video-entry', durationMs: Date.now() - updateStart });

      // Step 9: Trigger script generation workflow (if AUTO_PIPELINE enabled)
      const triggerStart = Date.now();
      await step.do('trigger-script-generation', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: RETRY_POLICIES.DEFAULT.delay,
          backoff: RETRY_POLICIES.DEFAULT.backoff
        }
      }, async () => {
        const autoPipeline = this.env.AUTO_PIPELINE === 'true';
        if (!autoPipeline) {
          log.videoSelectionWorkflow.info(reqId, 'Auto-pipeline disabled, stopping after selection', { videoId });
          return;
        }

        const params = { videoId };
        await this.env.SCRIPT_GENERATION_WORKFLOW.create({
          id: `script-gen-${videoId}-${Date.now()}`,
          params
        });
        log.videoSelectionWorkflow.info(reqId, 'Script generation workflow triggered', { videoId });
      });
      log.videoSelectionWorkflow.info(reqId, 'Step completed', { step: 'trigger-script-generation', durationMs: Date.now() - triggerStart });

      log.videoSelectionWorkflow.info(reqId, 'Workflow completed', {
        durationMs: Date.now() - startTime,
        videoId,
        articlesProcessed: articles.length,
        selectedArticles: selectionResult.articles.length,
        videoFormat: selectionResult.videoFormat,
        urgency: selectionResult.urgency
      });

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
