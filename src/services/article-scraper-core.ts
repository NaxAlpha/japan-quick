/**
 * Core article scraping function - extracted from ArticleScraperWorkflow
 * Used by both ScheduledRefreshWorkflow and ArticleRescrapeWorkflow for serial processing
 * Handles the complete scraping lifecycle for a single article
 */

import { ArticleScraper } from './article-scraper.js';
import type { ArticleStatus } from '../types/article.js';

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
  console.log(`[scrapeArticleCore] Started for pickId=${pickId}, isRescrape=${isRescrape}`);

  try {
    // Step 1: Check if article exists in DB
    const existingArticle = await db.prepare(
      'SELECT id, status FROM articles WHERE pick_id = ?'
    ).bind(pickId).first() as { id: number; status: string } | null;

    // If not rescrape and article already exists with scraped status, skip
    if (!isRescrape && existingArticle &&
        (existingArticle.status === 'scraped_v1' || existingArticle.status === 'scraped_v2')) {
      console.log(`[scrapeArticleCore] pickId=${pickId} already scraped, skipping`);
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
        pickupResult = await scraper.scrapePickupPage(browser, pickId);
        console.log(`[scrapeArticleCore] pickId=${pickId} pickup scrape succeeded on attempt ${attempt}`);
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[scrapeArticleCore] Pickup scrape attempt ${attempt} failed for pickId=${pickId}:`, lastError);

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
          console.log(`[scrapeArticleCore] pickId=${pickId} retry attempt ${attempt + 1} failed, status updated to ${retryStatus}`);

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
      console.log(`[scrapeArticleCore] pickId=${pickId} is external or has no article URL, marking as not_available`);
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
    console.log(`[scrapeArticleCore] pickId=${pickId} starting article scrape for URL: ${pickupResult.articleUrl}`);
    const articleData = await scraper.scrapeArticlePage(browser, pickupResult.articleUrl);
    console.log(`[scrapeArticleCore] pickId=${pickId} article scraped: ${articleData.content?.length || 0} chars HTML, ${articleData.contentText?.length || 0} chars text`);

    // Step 4: Scrape comments (fault-tolerant - don't fail if comments scraping fails)
    console.log(`[scrapeArticleCore] pickId=${pickId} starting comments scrape`);
    let comments: any[] = [];
    try {
      comments = await scraper.scrapeCommentsPage(browser, pickupResult.articleUrl);
      console.log(`[scrapeArticleCore] pickId=${pickId} comments scraped: ${comments?.length || 0} comments`);
    } catch (commentError) {
      console.error(`[scrapeArticleCore] pickId=${pickId} comments scraping failed (will continue without comments):`, commentError instanceof Error ? commentError.message : commentError);
      comments = [];
    }

    // Prepare data for storage
    const article = { ...articleData, ...pickupResult };
    const commentsData = comments || [];
    const version = isRescrape ? 2 : 1;
    console.log(`[scrapeArticleCore] pickId=${pickId} preparing to save version ${version} to database`);

    // Step 5: Save article record
    let articleId: number;
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

    // Step 7: Save comments
    // Delete old comments for this version
    await db.prepare(
      'DELETE FROM article_comments WHERE article_id = ? AND version = ?'
    ).bind(articleId, version).run();

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

    console.log(`[scrapeArticleCore] Completed: pickId=${pickId}, status=${newStatus}, version=${version}`);

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
    console.error(`[scrapeArticleCore] FATAL ERROR for pickId=${pickId}:`, errorMessage);
    if (errorStack) {
      console.error(`[scrapeArticleCore] Stack trace:`, errorStack);
    }
    return {
      success: false,
      pickId,
      error: errorMessage
    };
  }
}
