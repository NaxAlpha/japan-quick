/**
 * ArticleRescrapeWorkflow - Cron-triggered workflow to rescrape articles
 * Finds articles with scheduled_rescrape_at <= now AND status = 'scraped_v1'
 * Scrapes each article serially with 10-second delays
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { scrapeArticleCore } from '../services/article-scraper-core.js';
import type { ArticleRescrapeParams, ArticleRescrapeResult } from '../types/article.js';

interface WorkflowEnv {
  BROWSER: any;
  DB: D1Database;
}

export class ArticleRescrapeWorkflow extends WorkflowEntrypoint<WorkflowEnv, ArticleRescrapeParams, ArticleRescrapeResult> {
  async run(event: WorkflowEvent<ArticleRescrapeParams>, step: WorkflowStep): Promise<ArticleRescrapeResult> {
    try {
      // Step 1: Find articles due for rescrape
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

      if (dueArticles.length === 0) {
        console.log('ArticleRescrapeWorkflow: No articles due for rescrape');
        return {
          success: true,
          triggeredCount: 0,
          pickIds: []
        };
      }

      console.log(`ArticleRescrapeWorkflow: Found ${dueArticles.length} articles due for rescrape`);

      // Step 2: Rescrape each article serially with delays
      const scrapedPickIds: string[] = [];
      const failedPickIds: string[] = [];

      for (let i = 0; i < dueArticles.length; i++) {
        const pickId = dueArticles[i];
        console.log(`[ArticleRescrapeWorkflow] Rescraping article ${i + 1}/${dueArticles.length}: pickId=${pickId}`);

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
        } else {
          failedPickIds.push(pickId);
        }

        // Add delay between articles (except after the last one)
        if (i < dueArticles.length - 1) {
          await step.sleep(`delay-after-${pickId}`, 10000); // 10 seconds
        }
      }

      console.log(`ArticleRescrapeWorkflow completed: scraped ${scrapedPickIds.length}, failed ${failedPickIds.length}`);

      return {
        success: true,
        triggeredCount: scrapedPickIds.length,
        pickIds: scrapedPickIds
      };
    } catch (error) {
      console.error('ArticleRescrapeWorkflow failed:', error);
      return {
        success: false,
        triggeredCount: 0,
        pickIds: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
