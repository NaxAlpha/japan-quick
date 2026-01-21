/**
 * NewsScraperWorkflow - Durable workflow for Yahoo News scraping
 * Handles caching check, then delegates to ScheduledNewsRefreshWorkflow for fresh scraping
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import type { YahooNewsResponse } from '../types/news.js';
import type { NewsScraperParams, NewsScraperResult, ScheduledRefreshResult } from './types.js';

interface WorkflowEnv {
  BROWSER: any;
  NEWS_CACHE: KVNamespace;
  DB: D1Database;
  SCHEDULED_REFRESH_WORKFLOW: Workflow;
}

const CACHE_KEY = 'yahoo-japan-top-picks';

export class NewsScraperWorkflow extends WorkflowEntrypoint<WorkflowEnv, NewsScraperParams, NewsScraperResult> {
  async run(event: WorkflowEvent<NewsScraperParams>, step: WorkflowStep): Promise<NewsScraperResult> {
    const params = event.payload;

    try {
      // Step 1: Check cache (unless skipCache is true)
      let cachedData: YahooNewsResponse | null = null;
      if (!params.skipCache) {
        cachedData = await step.do('check-cache', {
          retries: {
            limit: 3,
            delay: "1 second",
            backoff: "constant"
          }
        }, async () => {
          const cached = await this.env.NEWS_CACHE.get(CACHE_KEY, 'json');
          if (cached && typeof cached === 'object' && 'topPicks' in cached && Array.isArray(cached.topPicks)) {
            return cached as YahooNewsResponse;
          }
          return null;
        });
      }

      // If we have valid cached data, return it
      if (cachedData) {
        return {
          success: true,
          data: {
            ...cachedData,
            cached: true
          }
        };
      }

      // Step 2: Trigger ScheduledNewsRefreshWorkflow to scrape fresh data
      const refreshResult = await step.do('trigger-refresh-workflow', {
        retries: {
          limit: 3,
          delay: "2 seconds",
          backoff: "constant"
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

      // Check if the refresh workflow succeeded
      if (!refreshResult.success || !refreshResult.data) {
        return {
          success: false,
          error: refreshResult.error || 'Refresh workflow failed'
        };
      }

      // Return the fresh data from the refresh workflow
      return {
        success: true,
        data: refreshResult.data,
        snapshotName: refreshResult.snapshotName
      };
    } catch (error) {
      console.error('NewsScraperWorkflow failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
