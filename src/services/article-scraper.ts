/**
 * Yahoo News Article Scraper Service
 * Browser-based scraping for article content, images, and comments from Yahoo News Japan
 */

import puppeteer from '@cloudflare/puppeteer';
import type { ScrapedArticleData, ScrapedComment } from '../types/article.js';
import { log, generateRequestId } from '../lib/logger.js';

const USER_AGENT = 'Mozilla/5.0 (compatible; JapanQuick/1.0)';
const TIMEOUT_MS = 30000;

// Result of scraping a pickup page
export interface PickupScrapeResult {
  isExternal: boolean;
  articleUrl?: string;
  articleId?: string;
}

// Full scrape result including article and comments
export interface FullScrapeResult {
  isExternal: boolean;
  article?: ScrapedArticleData;
  comments?: ScrapedComment[];
}

export class ArticleScraper {
  /**
   * Scrape the pickup page to get the article URL
   * Returns whether the article is external (not available) or internal Yahoo article
   */
  async scrapePickupPage(reqId: string, browser: any, pickId: string): Promise<PickupScrapeResult> {
    const startTime = Date.now();
    log.articleScraper.info(reqId, 'Pickup page scraping started', { pickId });

    const pickupUrl = `https://news.yahoo.co.jp/pickup/${pickId}`;

    try {
      const result = await this.scrapePickupWithBrowser(reqId, browser, pickupUrl);
      const durationMs = Date.now() - startTime;

      log.articleScraper.info(reqId, 'Pickup page scraping completed', {
        pickId,
        isExternal: result.isExternal,
        hasArticleUrl: !!result.articleUrl,
        articleId: result.articleId || 'N/A',
        durationMs
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      log.articleScraper.error(reqId, 'Pickup page scraping failed', {
        pickId,
        error: error instanceof Error ? error.message : String(error),
        durationMs
      });
      throw error;
    }
  }

  private async scrapePickupWithBrowser(reqId: string, browserBinding: any, pickupUrl: string): Promise<PickupScrapeResult> {
    if (!browserBinding) {
      log.articleScraper.error(reqId, 'Browser binding not available');
      throw new Error('Browser binding is not available. Browser rendering is required for scraping.');
    }

    log.articleScraper.info(reqId, 'Launching browser for pickup page', { pickupUrl });
    const browser = await puppeteer.launch(browserBinding);
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    log.articleScraper.info(reqId, 'Loading pickup page', { pickupUrl });
    await page.goto(pickupUrl, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT_MS
    });
    log.articleScraper.info(reqId, 'Pickup page loaded successfully', { pickupUrl });

    const result = await page.evaluate(() => {
      // Look for the "記事全文を読む" link
      const links = document.querySelectorAll('a');
      for (const link of links) {
        if (link.textContent?.includes('記事全文を読む')) {
          const href = link.getAttribute('href');
          if (href) {
            // Check if it's an external link or Yahoo article
            const isYahooArticle = href.includes('news.yahoo.co.jp/articles/');
            if (isYahooArticle) {
              // Extract article ID from URL like /articles/abc123
              const match = href.match(/\/articles\/([a-z0-9]+)/i);
              return {
                isExternal: false,
                articleUrl: href.startsWith('http') ? href : `https://news.yahoo.co.jp${href}`,
                articleId: match ? match[1] : undefined
              };
            } else {
              return { isExternal: true };
            }
          }
        }
      }

      // Try to find article URL in __NEXT_DATA__ or inline JSON
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent || '';
        if (content.includes('"article"') && content.includes('"url"')) {
          try {
            // Try to extract article URL from JSON
            const urlMatch = content.match(/"url"\s*:\s*"(https?:\/\/news\.yahoo\.co\.jp\/articles\/[^"]+)"/);
            if (urlMatch) {
              const articleUrl = urlMatch[1];
              const idMatch = articleUrl.match(/\/articles\/([a-z0-9]+)/i);
              return {
                isExternal: false,
                articleUrl,
                articleId: idMatch ? idMatch[1] : undefined
              };
            }
          } catch {
            // Continue searching
          }
        }
      }

      return { isExternal: true };
    });

    log.articleScraper.info(reqId, 'Extracted pickup page data', {
      isExternal: result.isExternal,
      hasArticleUrl: !!result.articleUrl,
      articleId: result.articleId || 'N/A'
    });

    await page.close();
    await browser.disconnect();
    return result;
  }

  /**
   * Scrape the article page content
   */
  async scrapeArticlePage(reqId: string, browser: any, articleUrl: string): Promise<ScrapedArticleData> {
    const startTime = Date.now();
    log.articleScraper.info(reqId, 'Article page scraping started', { articleUrl });

    try {
      const result = await this.scrapeArticleWithBrowser(reqId, browser, articleUrl);
      const durationMs = Date.now() - startTime;

      log.articleScraper.info(reqId, 'Article page scraping completed', {
        articleUrl,
        articleId: result.articleId || 'N/A',
        title: result.title || 'N/A',
        pageCount: result.pageCount,
        imageCount: result.images?.length || 0,
        durationMs
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      log.articleScraper.error(reqId, 'Article page scraping failed', {
        articleUrl,
        error: error instanceof Error ? error.message : String(error),
        durationMs
      });
      throw error;
    }
  }

  private async scrapeArticleWithBrowser(reqId: string, browserBinding: any, articleUrl: string): Promise<ScrapedArticleData> {
    if (!browserBinding) {
      log.articleScraper.error(reqId, 'Browser binding not available');
      throw new Error('Browser binding is not available. Browser rendering is required for scraping.');
    }

    log.articleScraper.info(reqId, 'Launching browser for article page', { articleUrl });
    const browser = await puppeteer.launch(browserBinding);
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    log.articleScraper.info(reqId, 'Loading article page', { articleUrl });
    await page.goto(articleUrl, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT_MS
    });
    log.articleScraper.info(reqId, 'Article page loaded successfully', { articleUrl });

    const firstPageData = await page.evaluate(() => {
      // Extract title from article h1
      const articleElement = document.querySelector('article');
      const h1 = articleElement?.querySelector('h1') || document.querySelector('h1');
      const title = h1?.textContent?.trim() || '';

      // Extract source from JSON-LD or meta
      let source = '';
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of jsonLdScripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          if (data.author?.name) {
            source = data.author.name;
            break;
          }
        } catch {
          // Continue
        }
      }

      // Extract dates
      let publishedAt = '';
      let modifiedAt = '';
      const pubdateMeta = document.querySelector('meta[name="pubdate"]');
      if (pubdateMeta) {
        publishedAt = pubdateMeta.getAttribute('content') || '';
      }
      for (const script of jsonLdScripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          if (data.datePublished) publishedAt = data.datePublished;
          if (data.dateModified) modifiedAt = data.dateModified;
        } catch {
          // Continue
        }
      }

      // Extract content - keep full HTML in content field, extract clean text in contentText
      let content = '';
      let contentText = '';

      // Try article_body first (Yahoo's main content div)
      const articleBody = document.querySelector('.article_body');
      if (articleBody) {
        // Store full HTML
        content = articleBody.innerHTML;

        // Extract clean text from paragraphs and headings
        const contentElements = articleBody.querySelectorAll('p, h2');
        const textParagraphs: string[] = [];

        contentElements.forEach(el => {
          // Clone the element to manipulate without affecting the DOM
          const clone = el.cloneNode(true) as HTMLElement;

          // Remove unwanted elements (social buttons, SVGs, icons)
          clone.querySelectorAll('svg, button, [class*="social"], [class*="share"], [class*="icon"]').forEach(unwanted => {
            unwanted.remove();
          });

          // Replace links with their text content (keep text, remove link markup)
          clone.querySelectorAll('a').forEach(link => {
            const text = document.createTextNode(link.textContent || '');
            link.replaceWith(text);
          });

          // Get clean text content
          const text = clone.textContent?.trim();
          if (text) {
            textParagraphs.push(text);
          }
        });

        // Join paragraphs with double newlines
        contentText = textParagraphs.join('\n\n');
      } else if (articleElement) {
        // Fallback: extract from article tag
        const contentElements = articleElement.querySelectorAll('p, h2, h3, h4');
        const htmlContents: string[] = [];
        const textParagraphs: string[] = [];

        contentElements.forEach(el => {
          // Skip navigation and metadata elements
          const parent = el.closest('header, footer, nav, aside');
          if (!parent) {
            htmlContents.push(el.outerHTML);

            // Extract clean text
            const clone = el.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('svg, button, [class*="social"], [class*="share"], [class*="icon"]').forEach(unwanted => {
              unwanted.remove();
            });
            clone.querySelectorAll('a').forEach(link => {
              const text = document.createTextNode(link.textContent || '');
              link.replaceWith(text);
            });

            const text = clone.textContent?.trim();
            if (text) {
              textParagraphs.push(text);
            }
          }
        });

        content = htmlContents.join('\n');
        contentText = textParagraphs.join('\n\n');
      }

      // Extract images from article body
      const images: string[] = [];
      const imgElements = (articleBody || articleElement || document).querySelectorAll('img');
      imgElements.forEach(img => {
        const src = img.getAttribute('src');
        // Get high-quality images only (skip tiny icons/buttons)
        if (src && src.startsWith('http') && !src.includes('icon') && !src.includes('svg')) {
          images.push(src);
        }
      });

      // Extract thumbnail from og:image
      const ogImage = document.querySelector('meta[property="og:image"]');
      const thumbnailUrl = ogImage?.getAttribute('content') || '';

      // Check for pagination using multiple strategies
      let maxPage = 1;

      // Strategy 1: Look for a[href*="?page="] links
      const pageLinks = document.querySelectorAll('a[href*="?page="]');
      const pageNumbers: number[] = [];
      pageLinks.forEach(link => {
        const href = link.getAttribute('href') || '';
        const match = href.match(/\?page=(\d+)/);
        if (match) {
          pageNumbers.push(parseInt(match[1], 10));
        }
      });

      // Strategy 2: Check for pagination container
      const paginationContainer = document.querySelector('.sc-brfqoi-0, [class*="pagination"], .pagination');
      if (paginationContainer) {
        const paginationLinks = paginationContainer.querySelectorAll('a[href*="?page="]');
        paginationLinks.forEach(link => {
          const href = link.getAttribute('href') || '';
          const match = href.match(/\?page=(\d+)/);
          if (match) {
            pageNumbers.push(parseInt(match[1], 10));
          }
        });
      }

      if (pageNumbers.length > 0) {
        maxPage = Math.max(...pageNumbers);
      }

      // Extract article ID from URL
      const articleIdMatch = window.location.href.match(/\/articles\/([a-z0-9]+)/i);
      const articleId = articleIdMatch ? articleIdMatch[1] : '';

      return {
        articleUrl: window.location.href,
        articleId,
        title,
        source,
        thumbnailUrl,
        publishedAt,
        modifiedAt,
        content,
        contentText,
        pageCount: maxPage,
        images
      };
    });

    log.articleScraper.info(reqId, 'Article content extracted', {
      articleUrl,
      articleId: firstPageData.articleId || 'N/A',
      title: firstPageData.title || 'N/A',
      contentLength: firstPageData.content?.length || 0,
      pageCount: firstPageData.pageCount
    });

    // If there are multiple pages, scrape them too
    if (firstPageData.pageCount > 1) {
      log.articleScraper.info(reqId, 'Multi-page article detected, starting pagination scrape', {
        articleUrl,
        pageCount: firstPageData.pageCount
      });

      const allContent = [firstPageData.content];
      const allContentText = [firstPageData.contentText || ''];
      const allImages = [...firstPageData.images];

      for (let pageNum = 2; pageNum <= firstPageData.pageCount; pageNum++) {
        log.articleScraper.info(reqId, 'Scraping article page', {
          articleUrl,
          pageNum,
          totalPages: firstPageData.pageCount
        });

        const pageUrl = `${articleUrl}?page=${pageNum}`;
        await page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUT_MS
        });

        const pageData = await page.evaluate(() => {
          let content = '';
          let contentText = '';

          // Use semantic selectors for content
          const articleBody = document.querySelector('.article_body');
          const articleElement = document.querySelector('article');

          if (articleBody) {
            content = articleBody.innerHTML;

            // Extract clean text
            const contentElements = articleBody.querySelectorAll('p, h2');
            const textParagraphs: string[] = [];

            contentElements.forEach(el => {
              const clone = el.cloneNode(true) as HTMLElement;
              clone.querySelectorAll('svg, button, [class*="social"], [class*="share"], [class*="icon"]').forEach(unwanted => {
                unwanted.remove();
              });
              clone.querySelectorAll('a').forEach(link => {
                const text = document.createTextNode(link.textContent || '');
                link.replaceWith(text);
              });

              const text = clone.textContent?.trim();
              if (text) {
                textParagraphs.push(text);
              }
            });

            contentText = textParagraphs.join('\n\n');
          } else if (articleElement) {
            const contentElements = articleElement.querySelectorAll('p, h2, h3, h4');
            const htmlContents: string[] = [];
            const textParagraphs: string[] = [];

            contentElements.forEach(el => {
              const parent = el.closest('header, footer, nav, aside');
              if (!parent) {
                htmlContents.push(el.outerHTML);

                const clone = el.cloneNode(true) as HTMLElement;
                clone.querySelectorAll('svg, button, [class*="social"], [class*="share"], [class*="icon"]').forEach(unwanted => {
                  unwanted.remove();
                });
                clone.querySelectorAll('a').forEach(link => {
                  const text = document.createTextNode(link.textContent || '');
                  link.replaceWith(text);
                });

                const text = clone.textContent?.trim();
                if (text) {
                  textParagraphs.push(text);
                }
              }
            });

            content = htmlContents.join('\n');
            contentText = textParagraphs.join('\n\n');
          }

          const images: string[] = [];
          const imgElements = (articleBody || articleElement || document).querySelectorAll('img');
          imgElements.forEach(img => {
            const src = img.getAttribute('src');
            if (src && src.startsWith('http') && !src.includes('icon') && !src.includes('svg')) {
              images.push(src);
            }
          });

          return { content, contentText, images };
        });

        allContent.push(pageData.content);
        allContentText.push(pageData.contentText);
        allImages.push(...pageData.images);

        log.articleScraper.info(reqId, 'Article page scraped', {
          articleUrl,
          pageNum,
          contentLength: pageData.content?.length || 0,
          imageCount: pageData.images?.length || 0
        });
      }

      log.articleScraper.info(reqId, 'Pagination scraping completed', {
        articleUrl,
        totalPagesScraped: firstPageData.pageCount,
        totalContentLength: allContent.join('').length,
        totalImages: allImages.length
      });

      firstPageData.content = allContent.join('\n<!-- page break -->\n');
      firstPageData.contentText = allContentText.join('\n\n');
      firstPageData.images = [...new Set(allImages)]; // Deduplicate
    }

    await page.close();
    await browser.disconnect();
    return firstPageData;
  }

  /**
   * Scrape comments from the article's comments page
   */
  async scrapeCommentsPage(reqId: string, browser: any, articleUrl: string): Promise<ScrapedComment[]> {
    const startTime = Date.now();
    const commentsUrl = `${articleUrl}/comments`;
    log.articleScraper.info(reqId, 'Comments scraping started', { articleUrl, commentsUrl });

    try {
      const result = await this.scrapeCommentsWithBrowser(reqId, browser, commentsUrl);
      const durationMs = Date.now() - startTime;

      log.articleScraper.info(reqId, 'Comments scraping completed', {
        articleUrl,
        commentsUrl,
        commentCount: result.length,
        durationMs
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      log.articleScraper.error(reqId, 'Comments scraping failed', {
        articleUrl,
        commentsUrl,
        error: error instanceof Error ? error.message : String(error),
        durationMs
      });
      throw error;
    }
  }

  private async scrapeCommentsWithBrowser(reqId: string, browserBinding: any, commentsUrl: string): Promise<ScrapedComment[]> {
    if (!browserBinding) {
      log.articleScraper.error(reqId, 'Browser binding not available');
      throw new Error('Browser binding is not available. Browser rendering is required for scraping.');
    }

    log.articleScraper.info(reqId, 'Launching browser for comments page', { commentsUrl });
    const browser = await puppeteer.launch(browserBinding);
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    try {
      log.articleScraper.info(reqId, 'Loading comments page', { commentsUrl });
      await page.goto(commentsUrl, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT_MS
      });
      log.articleScraper.info(reqId, 'Comments page loaded successfully', { commentsUrl });
    } catch (error) {
      // Comments page might not exist
      log.articleScraper.warn(reqId, 'Comments page not accessible, returning empty comments', {
        commentsUrl,
        error: error instanceof Error ? error.message : String(error)
      });
      await page.close();
      await browser.disconnect();
      return [];
    }

    const comments = await page.evaluate(() => {
      const results: Array<{
        commentId?: string;
        author?: string;
        content: string;
        postedAt?: string;
        likes: number;
        repliesCount: number;
      }> = [];

      // Try to find comments in inline JSON
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent || '';
        if (content.includes('"comments"') || content.includes('"text"')) {
          try {
            // Look for comment patterns in JSON
            const textMatches = content.matchAll(/"text"\s*:\s*"([^"]+)"/g);
            for (const match of textMatches) {
              const text = match[1];
              // Skip very short or non-comment text
              if (text.length > 10 && !text.includes('http')) {
                results.push({
                  content: text,
                  likes: 0,
                  repliesCount: 0
                });
              }
            }
          } catch {
            // Continue
          }
        }
      }

      // Also try to find comments in HTML elements
      const commentElements = document.querySelectorAll('[data-comment-id], .comment-item, .Comment');
      commentElements.forEach(el => {
        const commentId = el.getAttribute('data-comment-id') || undefined;
        const authorEl = el.querySelector('.comment-author, .author');
        const contentEl = el.querySelector('.comment-content, .comment-text');
        const timeEl = el.querySelector('time, .comment-time');
        const likesEl = el.querySelector('.likes-count, .thumbs-up');

        if (contentEl) {
          results.push({
            commentId,
            author: authorEl?.textContent?.trim(),
            content: contentEl.textContent?.trim() || '',
            postedAt: timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim(),
            likes: parseInt(likesEl?.textContent || '0', 10) || 0,
            repliesCount: 0
          });
        }
      });

      return results;
    });

    log.articleScraper.info(reqId, 'Comments extracted from page', {
      commentsUrl,
      commentCount: comments.length
    });

    await page.close();
    await browser.disconnect();
    return comments;
  }

  /**
   * Full scrape: pickup page -> article -> comments
   */
  async scrapeFullArticle(reqId: string, browser: any, pickId: string): Promise<FullScrapeResult> {
    const startTime = Date.now();
    log.articleScraper.info(reqId, 'Full article scraping started', { pickId });

    try {
      // Step 1: Scrape pickup page to get article URL
      log.articleScraper.info(reqId, 'Step 1: Scraping pickup page', { pickId });
      const pickupResult = await this.scrapePickupPage(reqId, browser, pickId);

      if (pickupResult.isExternal || !pickupResult.articleUrl) {
        log.articleScraper.info(reqId, 'Article is external, skipping further scraping', {
          pickId,
          isExternal: pickupResult.isExternal,
          hasArticleUrl: !!pickupResult.articleUrl
        });
        return { isExternal: true };
      }

      // Step 2: Scrape article content
      log.articleScraper.info(reqId, 'Step 2: Scraping article content', {
        pickId,
        articleUrl: pickupResult.articleUrl
      });
      const article = await this.scrapeArticlePage(reqId, browser, pickupResult.articleUrl);

      // Step 3: Scrape comments
      log.articleScraper.info(reqId, 'Step 3: Scraping comments', {
        pickId,
        articleUrl: pickupResult.articleUrl
      });
      const comments = await this.scrapeCommentsPage(reqId, browser, pickupResult.articleUrl);

      const durationMs = Date.now() - startTime;
      log.articleScraper.info(reqId, 'Full article scraping completed', {
        pickId,
        articleId: article.articleId || 'N/A',
        articleTitle: article.title || 'N/A',
        commentCount: comments.length,
        pageCount: article.pageCount,
        durationMs
      });

      return {
        isExternal: false,
        article,
        comments
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      log.articleScraper.error(reqId, 'Full article scraping failed', {
        pickId,
        error: error instanceof Error ? error.message : String(error),
        durationMs
      });
      throw error;
    }
  }
}
