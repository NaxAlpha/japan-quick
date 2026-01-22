/**
 * ArticleRescrapeWorkflow - Cron-triggered workflow to rescrape articles
 * Finds articles with scheduled_rescrape_at <= now AND status = 'scraped_v1'
 * Triggers ArticleScraperWorkflow with isRescrape=true for each
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import type { ArticleRescrapeParams, ArticleRescrapeResult } from '../types/article.js';

interface WorkflowEnv {
  DB: D1Database;
  ARTICLE_SCRAPER_WORKFLOW: Workflow;
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

      // Step 2: Trigger rescrapes for each article
      const triggeredPickIds = await step.do('trigger-rescrapes', {
        retries: {
          limit: 3,
          delay: "2 seconds",
          backoff: "constant"
        }
      }, async () => {
        const triggered: string[] = [];

        for (const pickId of dueArticles) {
          try {
            await this.env.ARTICLE_SCRAPER_WORKFLOW.create({
              params: {
                pickId,
                isRescrape: true
              }
            });
            triggered.push(pickId);
          } catch (error) {
            console.error(`Failed to trigger rescrape for pickId=${pickId}:`, error);
          }
        }

        return triggered;
      });

      console.log(`ArticleRescrapeWorkflow completed: triggered ${triggeredPickIds.length} rescrapes`);

      return {
        success: true,
        triggeredCount: triggeredPickIds.length,
        pickIds: triggeredPickIds
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
