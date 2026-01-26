/**
 * Core article scraping function - extracted from ArticleScraperWorkflow
 * Used by both ScheduledRefreshWorkflow and ArticleRescrapeWorkflow for serial processing
 * Handles the complete scraping lifecycle for a single article
 */

import { ArticleScraper } from './article-scraper.js';
import type { ArticleStatus } from '../types/article.js';
import { log, generateRequestId } from '../lib/logger.js';
import {
  checkArticleForScraping,
  upsertArticle,
  upsertArticleVersion,
  upsertArticleComments,
  updateArticleStatus,
} from '../lib/db-helpers.js';

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
    const existingArticle = await checkArticleForScraping(db, pickId);

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
          await upsertArticle(db, { pickId, status: retryStatus });
          log.articleScraperCore.info('Retry attempt failed, status updated', { pickId, attemptNumber: attempt + 1, status: retryStatus });

          // Wait before next retry (exponential backoff)
          await sleep((attempt + 1) * 5 * 1000); // 5s, 10s
        } else {
          // Final attempt failed - mark as error
          await upsertArticle(db, { pickId, status: 'error' });

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
      await upsertArticle(db, { pickId, status: 'not_available' });

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
    log.articleScraperCore.info('Saving article record', { pickId, exists: !!existingArticle });
    const articleId = await upsertArticle(db, {
      pickId,
      status: 'pending',
      articleUrl: article.articleUrl,
      articleId: article.articleId,
      title: article.title,
      source: article.source,
      thumbnailUrl: article.thumbnailUrl,
      publishedAt: article.publishedAt,
      modifiedAt: article.modifiedAt,
    });
    log.articleScraperCore.info('Article record saved', { pickId, articleId });

    // Step 6: Save version
    await upsertArticleVersion(db, {
      articleId,
      version,
      content: article.content,
      contentText: article.contentText,
      pageCount: article.pageCount,
      images: article.images,
    });
    log.articleScraperCore.info('Article version saved', { pickId, articleId, version, pageCount: article.pageCount });

    // Step 7: Save comments
    await upsertArticleComments(db, {
      articleId,
      version,
      comments: commentsData,
    });
    log.articleScraperCore.info('Comments saved', { pickId, articleId, version, commentCount: commentsData.length });

    // Step 8: Update status and schedule rescrape
    const newStatus: ArticleStatus = isRescrape ? 'scraped_v2' : 'scraped_v1';
    await updateArticleStatus(db, articleId, newStatus, {
      firstScrapedAt: !isRescrape,
      secondScrapedAt: isRescrape,
      scheduleRescrape: !isRescrape,
      rescrapeMinutes: 15,
    });

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
