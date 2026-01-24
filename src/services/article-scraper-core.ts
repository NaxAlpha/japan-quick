/**
 * Core article scraping function - extracted from ArticleScraperWorkflow
 * Used by both ScheduledRefreshWorkflow and ArticleRescrapeWorkflow for serial processing
 * Handles the complete scraping lifecycle for a single article
 */

import { ArticleScraper } from './article-scraper.js';
import type { ArticleStatus } from '../types/article.js';
import { log, generateRequestId } from '../lib/logger.js';

interface ScrapeArticleCoreParams {
  browser: any;
  db: D1Database;
  pickId: string;
  isRescrape: boolean;
}

interface ScrapeArticleCoreResult {
  success: boolean;
  pickId: string;
  status?: ArticleStatus;
  articleUrl?: string;
  title?: string;
  error?: string;
}

/**
 * Helper function to sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Core scraping function that handles:
 * 1. Check existing article
 * 2. Scrape pickup page (3 attempts with retry tracking)
 * 3. Scrape article content
 * 4. Scrape comments
 * 5. Save to database (article, version, comments)
 * 6. Update status and schedule rescrape for v1
 */
export async function scrapeArticleCore(params: ScrapeArticleCoreParams): Promise<ScrapeArticleCoreResult> {
  const { browser, db, pickId, isRescrape } = params;
  const startTime = Date.now();
  log.articleScraperCore.info('Scraping started', { pickId, isRescrape });

  try {
    // Step 1: Check if article exists in DB
    const existingArticle = await db.prepare(
      'SELECT id, status FROM articles WHERE pick_id = ?'
    ).bind(pickId).first() as { id: number; status: string } | null;

    // If not rescrape and article already exists with scraped status, skip
    if (!isRescrape && existingArticle &&
        (existingArticle.status === 'scraped_v1' || existingArticle.status === 'scraped_v2')) {
      log.articleScraperCore.info('Article already scraped, skipping', { pickId, status: existingArticle.status });
      return {
        success: true,
        pickId,
        status: existingArticle.status as ArticleStatus
      };
    }

    // Step 2: Scrape pickup page with retry tracking
    let pickupResult: any = null;
    let lastError: string = '';
    const maxRetries = 2; // retry_1, retry_2, then error
    const scraper = new ArticleScraper();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const reqId = generateRequestId();
        pickupResult = await scraper.scrapePickupPage(reqId, browser, pickId);
        log.articleScraperCore.info('Pickup page scrape succeeded', { pickId, attempt });
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        log.articleScraperCore.error('Pickup page scrape attempt failed', { pickId, attempt, error: lastError });

        // Update status based on attempt number
        if (attempt < maxRetries) {
          const retryStatus: ArticleStatus = attempt === 0 ? 'retry_1' : 'retry_2';
          await db.prepare(`
            INSERT INTO articles (pick_id, status, detected_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(pick_id) DO UPDATE SET
              status = excluded.status,
              updated_at = datetime('now')
          `).bind(pickId, retryStatus).run();
          log.articleScraperCore.info('Retry attempt failed, status updated', { pickId, attemptNumber: attempt + 1, status: retryStatus });

          // Wait before next retry (exponential backoff)
          await sleep((attempt + 1) * 5 * 1000); // 5s, 10s
        } else {
          // Final attempt failed - mark as error
          await db.prepare(`
            INSERT INTO articles (pick_id, status, detected_at)
            VALUES (?, 'error', datetime('now'))
            ON CONFLICT(pick_id) DO UPDATE SET
              status = 'error',
              updated_at = datetime('now')
          `).bind(pickId).run();

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
      log.articleScraperCore.info('External article or no URL, marking as not available', { pickId, isExternal: pickupResult.isExternal, hasUrl: !!pickupResult.articleUrl });
      await db.prepare(`
        INSERT INTO articles (pick_id, status, detected_at)
        VALUES (?, 'not_available', datetime('now'))
        ON CONFLICT(pick_id) DO UPDATE SET
          status = 'not_available',
          updated_at = datetime('now')
      `).bind(pickId).run();

      return {
        success: true,
        pickId,
        status: 'not_available'
      };
    }

    // Step 3: Scrape article content
    log.articleScraperCore.info('Starting article content scrape', { pickId, url: pickupResult.articleUrl });
    const reqId = generateRequestId();
    const articleData = await scraper.scrapeArticlePage(reqId, browser, pickupResult.articleUrl);
    log.articleScraperCore.info('Article content scraped', {
      pickId,
      htmlChars: articleData.content?.length || 0,
      textChars: articleData.contentText?.length || 0
    });

    // Step 4: Scrape comments (fault-tolerant - don't fail if comments scraping fails)
    log.articleScraperCore.info('Starting comments scrape', { pickId });
    let comments: any[] = [];
    try {
      const reqId = generateRequestId();
      comments = await scraper.scrapeCommentsPage(reqId, browser, pickupResult.articleUrl);
      log.articleScraperCore.info('Comments scraped', { pickId, commentCount: comments?.length || 0 });
    } catch (commentError) {
      log.articleScraperCore.error('Comments scraping failed (continuing without comments)', {
        pickId,
        error: commentError instanceof Error ? commentError.message : String(commentError)
      });
      comments = [];
    }

    // Prepare data for storage
    const article = { ...articleData, ...pickupResult };
    const commentsData = comments || [];
    const version = isRescrape ? 2 : 1;
    log.articleScraperCore.info('Preparing to save to database', { pickId, version });

    // Step 5: Save article record
    let articleId: number;
    log.articleScraperCore.info('Saving article record', { pickId, exists: !!existingArticle });
    if (existingArticle) {
      // Update existing article
      await db.prepare(`
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
      articleId = existingArticle.id;
    } else {
      // Insert new article
      const result = await db.prepare(`
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
      articleId = result.meta.last_row_id as number;
      log.articleScraperCore.info('Article record inserted', { pickId, articleId });
    }

    // Step 6: Save version
    await db.prepare(`
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
    log.articleScraperCore.info('Article version saved', { pickId, articleId, version, pageCount: article.pageCount });

    // Step 7: Save comments
    // Delete old comments for this version
    await db.prepare(
      'DELETE FROM article_comments WHERE article_id = ? AND version = ?'
    ).bind(articleId, version).run();
    log.articleScraperCore.info('Old comments deleted', { pickId, articleId, version });

    // Insert new comments
    for (const comment of commentsData) {
      await db.prepare(`
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
    log.articleScraperCore.info('Comments saved', { pickId, articleId, version, commentCount: commentsData.length });

    // Step 8: Update status and schedule rescrape
    const newStatus: ArticleStatus = isRescrape ? 'scraped_v2' : 'scraped_v1';
    if (isRescrape) {
      // Version 2 - update second scraped time, clear scheduled rescrape
      await db.prepare(`
        UPDATE articles SET
          status = ?,
          second_scraped_at = datetime('now'),
          scheduled_rescrape_at = NULL,
          updated_at = datetime('now')
        WHERE id = ?
      `).bind(newStatus, articleId).run();
    } else {
      // Version 1 - update first scraped time, schedule rescrape in 15 minutes
      await db.prepare(`
        UPDATE articles SET
          status = ?,
          first_scraped_at = datetime('now'),
          scheduled_rescrape_at = datetime('now', '+15 minutes'),
          updated_at = datetime('now')
        WHERE id = ?
      `).bind(newStatus, articleId).run();
    }

    const durationMs = Date.now() - startTime;
    log.articleScraperCore.info('Scraping completed', {
      pickId,
      articleId,
      status: newStatus,
      version,
      durationMs
    });

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
    log.articleScraperCore.error('Fatal error during scraping', {
      pickId,
      error: errorMessage,
      stack: errorStack
    });
    return {
      success: false,
      pickId,
      error: errorMessage
    };
  }
}
