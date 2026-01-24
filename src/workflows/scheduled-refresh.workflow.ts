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
    console.log('[ScheduledNewsRefreshWorkflow] Started');
    try {
      // Step 1: Scrape fresh news (always, no cache check)
      console.log('[ScheduledNewsRefreshWorkflow] Starting fresh news scrape');
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
      console.log(`[ScheduledNewsRefreshWorkflow] News scrape completed: ${topPicks.length} items`);

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

      // Step 5: Find new articles to scrape
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
          console.log('No pickup IDs found in scraped news');
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

        if (newPickIds.length === 0) {
          console.log('No new pickup IDs to scrape');
          return [];
        }

        console.log(`Found ${newPickIds.length} new pickup IDs to scrape`);
        return newPickIds;
      });

      // Step 6: Scrape each new article serially with delays
      for (let i = 0; i < newPickIds.length; i++) {
        const pickId = newPickIds[i];
        console.log(`[ScheduledRefreshWorkflow] Scraping article ${i + 1}/${newPickIds.length}: pickId=${pickId}`);

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

        // Add delay between articles (except after the last one)
        if (i < newPickIds.length - 1) {
          await step.sleep(`delay-after-${pickId}`, 10000); // 10 seconds
        }
      }

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
