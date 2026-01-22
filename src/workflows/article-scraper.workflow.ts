/**
 * ArticleScraperWorkflow - Durable workflow for scraping Yahoo News articles
 * Steps:
 * 1. check-existing - Check if article exists in DB
 * 2. scrape-article - Browser scrape pickup + article + comments
 * 3. save-article - Insert/update article record
 * 4. save-version - Save content to article_versions
 * 5. save-comments - Save comments (delete old on v2)
 * 6. update-status - Update status and schedule rescrape if v1
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import puppeteer from '@cloudflare/puppeteer';
import type { ArticleScraperParams, ArticleScraperResult, ArticleStatus } from '../types/article.js';
import { ArticleScraper } from '../services/article-scraper.js';

interface WorkflowEnv {
  BROWSER: any;
  DB: D1Database;
  ADMIN_PASSWORD: string;
}

export class ArticleScraperWorkflow extends WorkflowEntrypoint<WorkflowEnv, ArticleScraperParams, ArticleScraperResult> {
  async run(event: WorkflowEvent<ArticleScraperParams>, step: WorkflowStep): Promise<ArticleScraperResult> {
    const { pickId, isRescrape = false } = event.payload;
    console.log(`[ArticleScraperWorkflow] Started for pickId=${pickId}, isRescrape=${isRescrape}`);

    try {
      // Step 1: Check if article exists in DB
      const existingArticle = await step.do('check-existing', {
        retries: {
          limit: 3,
          delay: "1 second",
          backoff: "constant"
        }
      }, async () => {
        const result = await this.env.DB.prepare(
          'SELECT id, status FROM articles WHERE pick_id = ?'
        ).bind(pickId).first();
        return result as { id: number; status: string } | null;
      });

      // If not rescrape and article already exists with scraped status, skip
      if (!isRescrape && existingArticle &&
          (existingArticle.status === 'scraped_v1' || existingArticle.status === 'scraped_v2')) {
        return {
          success: true,
          pickId,
          status: existingArticle.status as ArticleStatus
        };
      }

      // Step 2: Scrape with retry tracking
      let pickupResult: any = null;
      let lastError: string = '';
      const maxRetries = 2; // retry_1, retry_2, then error

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          pickupResult = await step.do(`scrape-pickup-attempt-${attempt}`, {
            retries: {
              limit: 1, // No automatic retries, we handle manually
              delay: "5 seconds",
              backoff: "constant"
            }
          }, async () => {
            // Use ArticleScraper directly with browser binding
            const scraper = new ArticleScraper();
            const result = await scraper.scrapePickupPage(this.env.BROWSER, pickId);
            return result;
          });

          // Success - break out of retry loop
          console.log(`[ArticleScraperWorkflow] pickId=${pickId} pickup scrape succeeded on attempt ${attempt}`);
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[ArticleScraperWorkflow] Pickup scrape attempt ${attempt} failed for pickId=${pickId}:`, lastError);

          // Update status based on attempt number
          if (attempt < maxRetries) {
            const retryStatus: ArticleStatus = attempt === 0 ? 'retry_1' : 'retry_2';
            await step.do(`update-retry-status-${attempt}`, async () => {
              // Use UPSERT to handle both new and existing articles
              await this.env.DB.prepare(`
                INSERT INTO articles (pick_id, status, detected_at)
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(pick_id) DO UPDATE SET
                  status = excluded.status,
                  updated_at = datetime('now')
              `).bind(pickId, retryStatus).run();
              console.log(`[ArticleScraperWorkflow] pickId=${pickId} retry attempt ${attempt + 1} failed, status updated to ${retryStatus}`);
            });

            // Wait before next retry (exponential backoff)
            await step.sleep(`retry-delay-${attempt}`, (attempt + 1) * 5 * 1000); // 5s, 10s
          } else {
            // Final attempt failed - mark as error
            await step.do('mark-as-error', async () => {
              // Use UPSERT to handle both new and existing articles
              await this.env.DB.prepare(`
                INSERT INTO articles (pick_id, status, detected_at)
                VALUES (?, 'error', datetime('now'))
                ON CONFLICT(pick_id) DO UPDATE SET
                  status = 'error',
                  updated_at = datetime('now')
              `).bind(pickId).run();
            });

            return {
              success: false,
              pickId,
              status: 'error',
              error: `All retry attempts failed: ${lastError}`
            };
          }
        }
      }

      // If external article, skip scraping
      if (pickupResult.isExternal || !pickupResult.articleUrl) {
        console.log(`[ArticleScraperWorkflow] pickId=${pickId} is external or has no article URL, marking as not_available`);
        await step.do('save-not-available', {
          retries: {
            limit: 3,
            delay: "2 seconds",
            backoff: "constant"
          }
        }, async () => {
          // Use UPSERT to handle both new and existing articles
          await this.env.DB.prepare(`
            INSERT INTO articles (pick_id, status, detected_at)
            VALUES (?, 'not_available', datetime('now'))
            ON CONFLICT(pick_id) DO UPDATE SET
              status = 'not_available',
              updated_at = datetime('now')
          `).bind(pickId).run();
        });

        return {
          success: true,
          pickId,
          status: 'not_available'
        };
      }

      // Step 3: Scrape article content
      console.log(`[ArticleScraperWorkflow] pickId=${pickId} starting article scrape for URL: ${pickupResult.articleUrl}`);
      const articleData = await step.do('scrape-article', {
        retries: {
          limit: 5,
          delay: "5 seconds",
          backoff: "exponential"
        }
      }, async () => {
        // Use ArticleScraper directly with browser binding
        const scraper = new ArticleScraper();
        const result = await scraper.scrapeArticlePage(this.env.BROWSER, pickupResult.articleUrl);
        return result;
      });
      console.log(`[ArticleScraperWorkflow] pickId=${pickId} article scraped: ${articleData.content?.length || 0} chars HTML, ${articleData.contentText?.length || 0} chars text`);

      // Step 4: Scrape comments
      console.log(`[ArticleScraperWorkflow] pickId=${pickId} starting comments scrape`);
      const comments = await step.do('scrape-comments', {
        retries: {
          limit: 3,
          delay: "5 seconds",
          backoff: "exponential"
        }
      }, async () => {
        // Use ArticleScraper directly with browser binding
        const scraper = new ArticleScraper();
        const result = await scraper.scrapeCommentsPage(this.env.BROWSER, pickupResult.articleUrl);
        return result;
      });
      console.log(`[ArticleScraperWorkflow] pickId=${pickId} comments scraped: ${comments?.length || 0} comments`);

      // Prepare data for storage
      const article = { ...articleData, ...pickupResult };
      const commentsData = comments || [];
      const version = isRescrape ? 2 : 1;
      console.log(`[ArticleScraperWorkflow] pickId=${pickId} preparing to save version ${version} to database`);

      // Step 3: Save article record
      const articleId = await step.do('save-article', {
        retries: {
          limit: 3,
          delay: "2 seconds",
          backoff: "constant"
        }
      }, async () => {
        if (existingArticle) {
          // Update existing article
          await this.env.DB.prepare(`
            UPDATE articles SET
              article_id = ?,
              article_url = ?,
              title = ?,
              source = ?,
              thumbnail_url = ?,
              published_at = ?,
              modified_at = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `).bind(
            article.articleId || null,
            article.articleUrl,
            article.title,
            article.source || null,
            article.thumbnailUrl || null,
            article.publishedAt || null,
            article.modifiedAt || null,
            existingArticle.id
          ).run();
          return existingArticle.id;
        } else {
          // Insert new article
          const result = await this.env.DB.prepare(`
            INSERT INTO articles (
              pick_id, article_id, article_url, status, title, source,
              thumbnail_url, published_at, modified_at, detected_at
            ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            pickId,
            article.articleId || null,
            article.articleUrl,
            article.title,
            article.source || null,
            article.thumbnailUrl || null,
            article.publishedAt || null,
            article.modifiedAt || null
          ).run();
          return result.meta.last_row_id;
        }
      });

      // Step 4: Save version
      await step.do('save-version', {
        retries: {
          limit: 3,
          delay: "2 seconds",
          backoff: "constant"
        }
      }, async () => {
        await this.env.DB.prepare(`
          INSERT INTO article_versions (
            article_id, version, content, content_text, page_count, images, scraped_at
          ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(article_id, version) DO UPDATE SET
            content = excluded.content,
            content_text = excluded.content_text,
            page_count = excluded.page_count,
            images = excluded.images,
            scraped_at = excluded.scraped_at
        `).bind(
          articleId,
          version,
          article.content,
          article.contentText || null,
          article.pageCount,
          JSON.stringify(article.images)
        ).run();
      });

      // Step 5: Save comments
      await step.do('save-comments', {
        retries: {
          limit: 3,
          delay: "2 seconds",
          backoff: "constant"
        }
      }, async () => {
        // Delete old comments for this version
        await this.env.DB.prepare(
          'DELETE FROM article_comments WHERE article_id = ? AND version = ?'
        ).bind(articleId, version).run();

        // Insert new comments
        for (const comment of commentsData) {
          await this.env.DB.prepare(`
            INSERT INTO article_comments (
              article_id, version, comment_id, author, content, posted_at, likes, replies_count, scraped_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            articleId,
            version,
            comment.commentId || null,
            comment.author || null,
            comment.content,
            comment.postedAt || null,
            comment.likes,
            comment.repliesCount
          ).run();
        }
      });

      // Step 6: Update status and schedule rescrape
      const newStatus: ArticleStatus = isRescrape ? 'scraped_v2' : 'scraped_v1';
      await step.do('update-status', {
        retries: {
          limit: 3,
          delay: "2 seconds",
          backoff: "constant"
        }
      }, async () => {
        if (isRescrape) {
          // Version 2 - update second scraped time, clear scheduled rescrape
          await this.env.DB.prepare(`
            UPDATE articles SET
              status = ?,
              second_scraped_at = datetime('now'),
              scheduled_rescrape_at = NULL,
              updated_at = datetime('now')
            WHERE id = ?
          `).bind(newStatus, articleId).run();
        } else {
          // Version 1 - update first scraped time, schedule rescrape in 1 hour
          await this.env.DB.prepare(`
            UPDATE articles SET
              status = ?,
              first_scraped_at = datetime('now'),
              scheduled_rescrape_at = datetime('now', '+15 minutes'),
              updated_at = datetime('now')
            WHERE id = ?
          `).bind(newStatus, articleId).run();
        }
      });

      console.log(`ArticleScraperWorkflow completed: pickId=${pickId}, status=${newStatus}, version=${version}`);

      return {
        success: true,
        pickId,
        status: newStatus,
        articleUrl: article.articleUrl,
        title: article.title
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error(`[ArticleScraperWorkflow] FATAL ERROR for pickId=${pickId}:`, errorMessage);
      if (errorStack) {
        console.error(`[ArticleScraperWorkflow] Stack trace:`, errorStack);
      }
      return {
        success: false,
        pickId,
        error: errorMessage
      };
    }
  }
}
