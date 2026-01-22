/**
 * ScheduledNewsRefreshWorkflow - Cron-triggered background refresh
 * Always scrapes fresh news (no cache check) every 15 minutes
 * Automatically cleans up snapshots older than 30 days
 * Triggers article scraping for new pickup IDs
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import puppeteer from '@cloudflare/puppeteer';
import { YahooNewsScraper } from '../services/news-scraper.js';
import type { YahooNewsResponse } from '../types/news.js';
import type { ScheduledRefreshParams, ScheduledRefreshResult } from './types.js';

interface WorkflowEnv {
  BROWSER: any;
  NEWS_CACHE: KVNamespace;
  DB: D1Database;
  ARTICLE_SCRAPER_WORKFLOW: Workflow;
  ADMIN_PASSWORD: string;
}

const CACHE_KEY = 'yahoo-japan-top-picks';
const CACHE_TTL = 300; // 5 minutes

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

      // Step 5: Trigger article scraping for new pickup IDs
      await step.do('trigger-article-scrapes', {
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
          return;
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
          return;
        }

        console.log(`Found ${newPickIds.length} new pickup IDs to scrape`);

        // Trigger article scraper workflow for each new pickId
        for (const pickId of newPickIds) {
          try {
            await this.env.ARTICLE_SCRAPER_WORKFLOW.create({
              params: {
                pickId,
                isRescrape: false
              }
            });
            console.log(`Triggered article scraper for pickId=${pickId}`);
          } catch (error) {
            console.error(`Failed to trigger article scraper for pickId=${pickId}:`, error);
          }
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
