/**
 * ArticleRescrapeWorkflow - Cron-triggered workflow to rescrape articles
 * Finds articles with scheduled_rescrape_at <= now AND status = 'scraped_v1'
 * Scrapes each article serially with 10-second delays
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { scrapeArticleCore } from '../services/article-scraper-core.js';
import type { ArticleRescrapeParams, ArticleRescrapeResult } from '../types/article.js';
import { log, generateRequestId } from '../lib/logger.js';

interface WorkflowEnv {
  BROWSER: any;
  DB: D1Database;
}

export class ArticleRescrapeWorkflow extends WorkflowEntrypoint<WorkflowEnv, ArticleRescrapeParams, ArticleRescrapeResult> {
  async run(event: WorkflowEvent<ArticleRescrapeParams>, step: WorkflowStep): Promise<ArticleRescrapeResult> {
    const reqId = generateRequestId();
    const workflowId = event.id;
    const startTime = Date.now();
    log.articleRescrapeWorkflow.info(reqId, 'Workflow started', { workflowId });

    try {
      // Step 1: Find articles due for rescrape
      const findStart = Date.now();
      const dueArticles = await step.do('find-due-articles', {
        retries: {
          limit: 3,
          delay: "2 seconds",
          backoff: "constant"
        }
      }, async () => {
        const result = await this.env.DB.prepare(`
          SELECT pick_id FROM articles
          WHERE status = 'scraped_v1'
            AND scheduled_rescrape_at IS NOT NULL
            AND datetime(scheduled_rescrape_at) <= datetime('now')
          LIMIT 50
        `).all();

        return result.results.map(row => (row as { pick_id: string }).pick_id);
      });
      log.articleRescrapeWorkflow.info(reqId, 'Step completed', { step: 'find-due-articles', durationMs: Date.now() - findStart, dueCount: dueArticles.length });

      if (dueArticles.length === 0) {
        log.articleRescrapeWorkflow.info(reqId, 'Workflow completed (no articles due)', { durationMs: Date.now() - startTime });
        return {
          success: true,
          triggeredCount: 0,
          pickIds: []
        };
      }

      // Step 2: Rescrape each article serially with delays
      const scrapedPickIds: string[] = [];
      const failedPickIds: string[] = [];

      for (let i = 0; i < dueArticles.length; i++) {
        const pickId = dueArticles[i];
        const articleStart = Date.now();

        const result = await step.do(`rescrape-article-${pickId}`, {
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
            isRescrape: true
          });
        });

        if (result.success) {
          scrapedPickIds.push(pickId);
          log.articleRescrapeWorkflow.info(reqId, 'Article rescraped successfully', { pickId, index: i + 1, total: dueArticles.length, durationMs: Date.now() - articleStart });
        } else {
          failedPickIds.push(pickId);
          log.articleRescrapeWorkflow.warn(reqId, 'Article rescrape failed', { pickId, index: i + 1, total: dueArticles.length, durationMs: Date.now() - articleStart, error: result.error });
        }

        // Add delay between articles (except after the last one)
        if (i < dueArticles.length - 1) {
          await step.sleep(`delay-after-${pickId}`, 10000); // 10 seconds
        }
      }

      log.articleRescrapeWorkflow.info(reqId, 'Workflow completed', { durationMs: Date.now() - startTime, scrapedCount: scrapedPickIds.length, failedCount: failedPickIds.length });

      return {
        success: true,
        triggeredCount: scrapedPickIds.length,
        pickIds: scrapedPickIds
      };
    } catch (error) {
      log.articleRescrapeWorkflow.error(reqId, 'Workflow failed', error as Error);
      return {
        success: false,
        triggeredCount: 0,
        pickIds: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
