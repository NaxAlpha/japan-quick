/**
 * ScheduledNewsRefreshWorkflow - Cron-triggered background refresh
 * Always scrapes fresh news (no cache check) every 15 minutes
 * Automatically cleans up snapshots older than 30 days
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { YahooNewsScraper } from '../services/news-scraper.js';
import type { YahooNewsResponse } from '../types/news.js';
import type { ScheduledRefreshParams, ScheduledRefreshResult } from './types.js';

interface WorkflowEnv {
  BROWSER: any;
  NEWS_CACHE: KVNamespace;
  DB: D1Database;
}

const CACHE_KEY = 'yahoo-japan-top-picks';
const CACHE_TTL = 300; // 5 minutes

export class ScheduledNewsRefreshWorkflow extends WorkflowEntrypoint<WorkflowEnv, ScheduledRefreshParams, ScheduledRefreshResult> {
  async run(event: WorkflowEvent<ScheduledRefreshParams>, step: WorkflowStep): Promise<ScheduledRefreshResult> {
    try {
      // Step 1: Scrape fresh news (always, no cache check)
      const topPicks = await step.do('scrape-fresh-news', {
        retries: {
          limit: 5,
          delay: "5 seconds",
          backoff: "exponential"
        }
      }, async () => {
        const scraper = new YahooNewsScraper();
        return await scraper.scrape(this.env.BROWSER);
      });

      // Build response object
      const newsData: YahooNewsResponse = {
        topPicks,
        scrapedAt: new Date().toISOString(),
        cached: false
      };

      // Step 2: Update cache
      await step.do('update-cache', {
        retries: {
          limit: 3,
          delay: "1 second",
          backoff: "constant"
        }
      }, async () => {
        await this.env.NEWS_CACHE.put(CACHE_KEY, JSON.stringify(newsData), {
          expirationTtl: CACHE_TTL
        });
      });

      // Step 3: Save snapshot to D1
      const snapshotName = await step.do('save-snapshot', {
        retries: {
          limit: 3,
          delay: "2 seconds",
          backoff: "constant"
        }
      }, async () => {
        const now = new Date();
        const snapshotName = `article-snapshot-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

        await this.env.DB.prepare(
          'INSERT INTO news_snapshots (captured_at, snapshot_name, data) VALUES (?, ?, ?)'
        )
          .bind(newsData.scrapedAt, snapshotName, JSON.stringify(newsData))
          .run();

        return snapshotName;
      });

      // Step 4: Clean up old snapshots (older than 30 days)
      await step.do('cleanup-old-snapshots', {
        retries: {
          limit: 3,
          delay: "1 second",
          backoff: "constant"
        }
      }, async () => {
        const result = await this.env.DB.prepare(
          "DELETE FROM news_snapshots WHERE datetime(captured_at) < datetime('now', '-30 days')"
        ).run();

        if (result.meta.changes > 0) {
          console.log(`Cleaned up ${result.meta.changes} old snapshots`);
        }
      });

      console.log(`Scheduled refresh completed: ${snapshotName} with ${topPicks.length} items`);

      return {
        success: true,
        data: newsData,
        snapshotName,
        scrapedCount: topPicks.length
      };
    } catch (error) {
      console.error('ScheduledNewsRefreshWorkflow failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
