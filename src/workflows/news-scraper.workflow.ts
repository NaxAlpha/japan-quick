/**
 * NewsScraperWorkflow - Durable workflow for Yahoo News scraping
 * Handles caching check, then delegates to ScheduledNewsRefreshWorkflow for fresh scraping
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import type { YahooNewsResponse } from '../types/news.js';
import type { NewsScraperParams, NewsScraperResult, ScheduledRefreshResult } from './types.js';
import { log, generateRequestId } from '../lib/logger.js';
import { RETRY_POLICIES, SCRAPING, VIDEO_RENDERING } from '../lib/constants.js';

interface WorkflowEnv {
  BROWSER: any;
  NEWS_CACHE: KVNamespace;
  DB: D1Database;
  SCHEDULED_REFRESH_WORKFLOW: Workflow;
}

const CACHE_KEY = 'yahoo-japan-top-picks';

export class NewsScraperWorkflow extends WorkflowEntrypoint<WorkflowEnv, NewsScraperParams, NewsScraperResult> {
  async run(event: WorkflowEvent<NewsScraperParams>, step: WorkflowStep): Promise<NewsScraperResult> {
    const reqId = generateRequestId();
    const workflowId = event.id;
    const params = event.payload;
    const startTime = Date.now();
    log.newsScraperWorkflow.info(reqId, 'Workflow started', { workflowId, skipCache: params.skipCache });

    try {
      // Step 1: Check cache (unless skipCache is true)
      const checkCacheStart = Date.now();
      let cachedData: YahooNewsResponse | null = null;
      if (!params.skipCache) {
        cachedData = await step.do('check-cache', {
          retries: {
            limit: RETRY_POLICIES.DEFAULT.limit,
            delay: RETRY_POLICIES.CACHE.delay,
            backoff: RETRY_POLICIES.DEFAULT.backoff
          }
        }, async () => {
          const cached = await this.env.NEWS_CACHE.get(CACHE_KEY, 'json');
          if (cached && typeof cached === 'object' && 'topPicks' in cached && Array.isArray(cached.topPicks)) {
            return cached as YahooNewsResponse;
          }
          return null;
        });
      }
      log.newsScraperWorkflow.info(reqId, 'Step completed', { step: 'check-cache', durationMs: Date.now() - checkCacheStart, cached: !!cachedData });

      // If we have valid cached data, return it
      if (cachedData) {
        log.newsScraperWorkflow.info(reqId, 'Workflow completed (cached)', { durationMs: Date.now() - startTime, itemCount: cachedData.topPicks.length });
        return {
          success: true,
          data: {
            ...cachedData,
            cached: true
          }
        };
      }

      // Step 2: Trigger ScheduledNewsRefreshWorkflow to scrape fresh data
      const refreshStart = Date.now();
      const refreshResult = await step.do('trigger-refresh-workflow', {
        retries: {
          limit: RETRY_POLICIES.DEFAULT.limit,
          delay: RETRY_POLICIES.DEFAULT.delay,
          backoff: RETRY_POLICIES.DEFAULT.backoff
        }
      }, async () => {
        // Create an instance of the scheduled refresh workflow
        const instance = await this.env.SCHEDULED_REFRESH_WORKFLOW.create({
          params: {}
        });

        // Wait for the workflow to complete
        let status = await instance.status();
        while (status.status === 'running' || status.status === 'queued') {
          // Wait 1 second before checking again
          await new Promise(resolve => setTimeout(resolve, 1000));
          status = await instance.status();
        }

        if (status.status !== 'complete') {
          throw new Error(`Workflow ${status.status}`);
        }

        return status.output as ScheduledRefreshResult;
      });
      log.newsScraperWorkflow.info(reqId, 'Step completed', { step: 'trigger-refresh-workflow', durationMs: Date.now() - refreshStart, success: refreshResult.success });

      // Check if the refresh workflow succeeded
      if (!refreshResult.success || !refreshResult.data) {
        log.newsScraperWorkflow.error(reqId, 'Refresh workflow failed', { error: refreshResult.error || 'Refresh workflow failed' });
        return {
          success: false,
          error: refreshResult.error || 'Refresh workflow failed'
        };
      }

      // Check if we got any items
      if (refreshResult.data.topPicks.length === 0) {
        log.newsScraperWorkflow.warn(reqId, 'Refresh workflow returned empty data', { itemCount: 0 });
        return {
          success: false,
          error: 'No news items found - scraping may have failed'
        };
      }

      // Return the fresh data from the refresh workflow
      log.newsScraperWorkflow.info(reqId, 'Workflow completed', { durationMs: Date.now() - startTime, itemCount: refreshResult.data.topPicks.length, snapshotName: refreshResult.snapshotName });
      return {
        success: true,
        data: refreshResult.data,
        snapshotName: refreshResult.snapshotName
      };
    } catch (error) {
      log.newsScraperWorkflow.error(reqId, 'Workflow failed', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
