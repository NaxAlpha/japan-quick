/**
 * ScheduledNewsRefreshWorkflow - Cron-triggered background refresh
 * Always scrapes fresh news (no cache check) every 30 minutes
 * Automatically cleans up snapshots older than 30 days
 * Triggers article scraping for new pickup IDs
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import puppeteer from '@cloudflare/puppeteer';
import { YahooNewsScraper } from '../services/news-scraper.js';
import { scrapeArticleCore } from '../services/article-scraper-core.js';
import type { YahooNewsResponse } from '../types/news.js';
import type { ScheduledRefreshParams, ScheduledRefreshResult } from './types.js';
import { log, generateRequestId } from '../lib/logger.js';

interface WorkflowEnv {
  BROWSER: any;
  NEWS_CACHE: KVNamespace;
  DB: D1Database;
  ADMIN_PASSWORD: string;
}

const CACHE_KEY = 'yahoo-japan-top-picks';
const CACHE_TTL = 2100; // 35 minutes

// Helper to extract pickId from a pickup URL
function extractPickId(url: string): string | null {
  const match = url.match(/\/pickup\/(\d+)$/);
  return match ? match[1] : null;
}

export class ScheduledNewsRefreshWorkflow extends WorkflowEntrypoint<WorkflowEnv, ScheduledRefreshParams, ScheduledRefreshResult> {
  async run(event: WorkflowEvent<ScheduledRefreshParams>, step: WorkflowStep): Promise<ScheduledRefreshResult> {
    const reqId = generateRequestId();
    const workflowId = event.id;
    const startTime = Date.now();
    log.scheduledRefreshWorkflow.info(reqId, 'Workflow started', { workflowId });

    try {
      // Step 1: Scrape fresh news (always, no cache check)
      const scrapeStart = Date.now();
      const topPicks = await step.do('scrape-fresh-news', {
        retries: {
          limit: 5,
          delay: "5 seconds",
          backoff: "exponential"
        }
      }, async () => {
        // Use YahooNewsScraper directly with browser binding
        const scraper = new YahooNewsScraper();
        const result = await scraper.scrape(this.env.BROWSER);
        return result;
      });
      log.scheduledRefreshWorkflow.info(reqId, 'Step completed', { step: 'scrape-fresh-news', durationMs: Date.now() - scrapeStart, itemCount: topPicks.length });

      // Build response object
      const newsData: YahooNewsResponse = {
        topPicks,
        scrapedAt: new Date().toISOString(),
        cached: false
      };

      // Step 2: Update cache
      const cacheStart = Date.now();
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
      log.scheduledRefreshWorkflow.info(reqId, 'Step completed', { step: 'update-cache', durationMs: Date.now() - cacheStart });

      // Step 3: Save snapshot to D1
      const snapshotStart = Date.now();
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
      log.scheduledRefreshWorkflow.info(reqId, 'Step completed', { step: 'save-snapshot', durationMs: Date.now() - snapshotStart, snapshotName });

      // Step 4: Clean up old snapshots (older than 30 days)
      const cleanupStart = Date.now();
      const cleanupCount = await step.do('cleanup-old-snapshots', {
        retries: {
          limit: 3,
          delay: "1 second",
          backoff: "constant"
        }
      }, async () => {
        const result = await this.env.DB.prepare(
          "DELETE FROM news_snapshots WHERE datetime(captured_at) < datetime('now', '-30 days')"
        ).run();

        return result.meta.changes;
      });
      log.scheduledRefreshWorkflow.info(reqId, 'Step completed', { step: 'cleanup-old-snapshots', durationMs: Date.now() - cleanupStart, deletedCount: cleanupCount });

      // Step 5: Find new articles to scrape
      const findArticlesStart = Date.now();
      const newPickIds = await step.do('find-new-articles', {
        retries: {
          limit: 3,
          delay: "2 seconds",
          backoff: "constant"
        }
      }, async () => {
        // Extract pickIds from scraped news
        const pickIds = topPicks
          .map(pick => extractPickId(pick.url))
          .filter((id): id is string => id !== null);

        if (pickIds.length === 0) {
          return [];
        }

        // Check which pickIds are new (not in articles table)
        const placeholders = pickIds.map(() => '?').join(', ');
        const existingResult = await this.env.DB.prepare(
          `SELECT pick_id FROM articles WHERE pick_id IN (${placeholders})`
        ).bind(...pickIds).all();

        const existingPickIds = new Set(
          existingResult.results.map(row => (row as { pick_id: string }).pick_id)
        );

        const newPickIds = pickIds.filter(id => !existingPickIds.has(id));

        return newPickIds;
      });
      log.scheduledRefreshWorkflow.info(reqId, 'Step completed', { step: 'find-new-articles', durationMs: Date.now() - findArticlesStart, newArticleCount: newPickIds.length });

      // Step 6: Scrape each new article serially with delays
      for (let i = 0; i < newPickIds.length; i++) {
        const pickId = newPickIds[i];
        const articleStart = Date.now();

        await step.do(`scrape-article-${pickId}`, {
          retries: {
            limit: 2,
            delay: "5 seconds",
            backoff: "constant"
          }
        }, async () => {
          return await scrapeArticleCore({
            browser: this.env.BROWSER,
            db: this.env.DB,
            pickId,
            isRescrape: false
          });
        });

        log.scheduledRefreshWorkflow.info(reqId, 'Article scraped', { pickId, index: i + 1, total: newPickIds.length, durationMs: Date.now() - articleStart });

        // Add delay between articles (except after the last one)
        if (i < newPickIds.length - 1) {
          await step.sleep(`delay-after-${pickId}`, 10000); // 10 seconds
        }
      }

      log.scheduledRefreshWorkflow.info(reqId, 'Workflow completed', { durationMs: Date.now() - startTime, itemCount: topPicks.length, newArticlesScraped: newPickIds.length, snapshotName });

      return {
        success: true,
        data: newsData,
        snapshotName,
        scrapedCount: topPicks.length
      };
    } catch (error) {
      log.scheduledRefreshWorkflow.error(reqId, 'Workflow failed', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
