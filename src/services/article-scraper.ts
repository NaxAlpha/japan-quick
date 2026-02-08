/**
 * Yahoo News Article Scraper Service
 * Browser-based scraping for article content, images, and comments from Yahoo News Japan
 */

import puppeteer from '@cloudflare/puppeteer';
import type { ScrapedArticleData, ScrapedComment, CommentReactions, CommentReply } from '../types/article.js';
import { log, generateRequestId } from '../lib/logger.js';
import { SCRAPING } from '../lib/constants.js';

// Result of scraping a pickup page
export interface PickupScrapeResult {
  isExternal: boolean;
  articleUrl?: string;
  articleId?: string;
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
    await page.setUserAgent(SCRAPING.USER_AGENT);

    log.articleScraper.info(reqId, 'Loading pickup page', { pickupUrl });
    await page.goto(pickupUrl, {
      waitUntil: 'domcontentloaded',
      timeout: SCRAPING.TIMEOUT_MS
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
    await page.setUserAgent(SCRAPING.USER_AGENT);

    log.articleScraper.info(reqId, 'Loading article page', { articleUrl });
    await page.goto(articleUrl, {
      waitUntil: 'domcontentloaded',
      timeout: SCRAPING.TIMEOUT_MS
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
          timeout: SCRAPING.TIMEOUT_MS
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
      // Return empty array instead of throwing - fault tolerance
      return [];
    }

    log.articleScraper.info(reqId, 'Launching browser for comments page', { commentsUrl });
    const browser = await puppeteer.launch(browserBinding);
    const page = await browser.newPage();
    await page.setUserAgent(SCRAPING.USER_AGENT);

    try {
      log.articleScraper.info(reqId, 'Loading comments page', { commentsUrl });
      await page.goto(commentsUrl, {
        waitUntil: 'domcontentloaded',
        timeout: SCRAPING.TIMEOUT_MS
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

    try {
      // Strategy 1: Try JSON extraction from window.__PRELOADED_STATE__
      log.articleScraper.info(reqId, 'Attempting JSON extraction from __PRELOADED_STATE__');
      let comments = await this.extractCommentsFromJSON(page, reqId);

      if (comments.length === 0) {
        // Strategy 2: Fallback to HTML parsing
        log.articleScraper.info(reqId, 'JSON extraction yielded no results, falling back to HTML parsing');
        comments = await this.extractCommentsFromHTML(page, reqId);
      }

      log.articleScraper.info(reqId, 'Initial comments extracted', { commentCount: comments.length });

      // Strategy 3: Expand truncated comments
      comments = await this.expandTruncatedComments(page, comments, reqId);
      log.articleScraper.info(reqId, 'Truncated comments expanded', { commentCount: comments.length });

      // Strategy 4: Extract nested replies
      comments = await this.extractNestedReplies(page, comments, reqId);
      log.articleScraper.info(reqId, 'Nested replies extracted', { commentCount: comments.length });

      log.articleScraper.info(reqId, 'Comments extraction completed', {
        commentsUrl,
        finalCommentCount: comments.length
      });

      await page.close();
      await browser.disconnect();
      return comments;
    } catch (error) {
      log.articleScraper.error(reqId, 'Comments extraction failed, returning empty array', {
        commentsUrl,
        error: error instanceof Error ? error.message : String(error)
      });
      await page.close();
      await browser.disconnect();
      return [];
    }
  }

  /**
   * Extract comments from window.__PRELOADED_STATE__ JSON object
   * This is faster and more reliable than HTML parsing
   */
  private async extractCommentsFromJSON(page: any, reqId: string): Promise<ScrapedComment[]> {
    try {
      const comments = await page.evaluate(() => {
        const results: Array<{
          commentId?: string;
          author?: string;
          content: string;
          postedAt?: string;
          likes: number;
          repliesCount: number;
          reactions: {
            empathized: number;
            understood: number;
            questioning: number;
          };
          replies: Array<{
            commentId?: string;
            author?: string;
            content: string;
            postedAt?: string;
            reactions?: {
              empathized: number;
              understood: number;
              questioning: number;
            };
          }>;
        }> = [];

        // Try to get preloaded state
        const preloadedState = (window as any).__PRELOADED_STATE__;
        if (!preloadedState) {
          return results;
        }

        // Navigate through the state structure to find comments
        // Yahoo News comment structure varies, so we try multiple paths
        const state = preloadedState?.responseCache || preloadedState;
        if (!state) {
          return results;
        }

        // Look for comments data in the state
        const stateKeys = Object.keys(state);
        for (const key of stateKeys) {
          const data = state[key];
          if (data?.comments) {
            const commentsData = data.comments;

            // Process comments based on structure
            const commentsList = commentsData.items || commentsData.data || commentsData;
            if (!Array.isArray(commentsList)) {
              continue;
            }

            for (const comment of commentsList) {
              // Extract comment data from various possible structures
              const commentData = comment.comment || comment;

              // Extract author
              let author: string | undefined;
              if (commentData.author?.nickname) {
                author = commentData.author.nickname;
              } else if (commentData.author?.name) {
                author = commentData.author.name;
              } else if (commentData.userProfile?.nickname) {
                author = commentData.userProfile.nickname;
              }

              // Extract content
              let content = '';
              if (commentData.content?.text) {
                content = commentData.content.text;
              } else if (commentData.body) {
                content = commentData.body;
              } else if (commentData.text) {
                content = commentData.text;
              }

              // Extract postedAt
              let postedAt: string | undefined;
              if (commentData.postedAt || commentData.created_at) {
                postedAt = commentData.postedAt || commentData.created_at;
              } else if (commentData.createdAt) {
                postedAt = commentData.createdAt;
              }

              // Extract reactions
              const reactions: { empathized: number; understood: number; questioning: number } = {
                empathized: 0,
                understood: 0,
                questioning: 0
              };

              if (commentData.reactions) {
                if (commentData.reactions.empathized || commentData.reactions.agree) {
                  reactions.empathized = commentData.reactions.empathized || commentData.reactions.agree || 0;
                }
                if (commentData.reactions.understood || commentData.reactions.insightful) {
                  reactions.understood = commentData.reactions.understood || commentData.reactions.insightful || 0;
                }
                if (commentData.reactions.questioning || commentData.reactions.doubtful) {
                  reactions.questioning = commentData.reactions.questioning || commentData.reactions.doubtful || 0;
                }
              } else if (commentData.likes !== undefined) {
                reactions.empathized = commentData.likes;
              }

              // Extract replies count
              let repliesCount = 0;
              if (commentData.repliesCount !== undefined) {
                repliesCount = commentData.repliesCount;
              } else if (commentData.reply_count !== undefined) {
                repliesCount = commentData.reply_count;
              }

              results.push({
                commentId: commentData.id || commentData.comment_id || commentData.pid,
                author,
                content,
                postedAt,
                likes: reactions.empathized, // For backwards compatibility
                repliesCount,
                reactions,
                replies: [] // Will be populated separately
              });
            }
          }
        }

        return results;
      });

      log.articleScraper.info(reqId, 'JSON extraction completed', { commentCount: comments.length });
      return comments;
    } catch (error) {
      log.articleScraper.error(reqId, 'JSON extraction failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Extract comments from HTML elements using CSS selectors
   * Fallback when JSON extraction fails
   */
  private async extractCommentsFromHTML(page: any, reqId: string): Promise<ScrapedComment[]> {
    try {
      const comments = await page.evaluate(() => {
        const results: Array<{
          commentId?: string;
          author?: string;
          content: string;
          postedAt?: string;
          likes: number;
          repliesCount: number;
          reactions: {
            empathized: number;
            understood: number;
            questioning: number;
          };
          replies: Array<{
            commentId?: string;
            author?: string;
            content: string;
            postedAt?: string;
            reactions?: {
              empathized: number;
              understood: number;
              questioning: number;
            };
          }>;
        }> = [];

        // Yahoo News comment selectors (based on exploration)
        const commentSelectors = [
          '.viewableWrapper article',
          'article[class*="iwTXsY"]',
          '[data-comment-id]',
          '.comment-item',
          '.Comment'
        ];

        for (const selector of commentSelectors) {
          const commentElements = document.querySelectorAll(selector);
          if (commentElements.length > 0) {
            commentElements.forEach(el => {
              // Extract comment ID
              let commentId: string | undefined;
              const articleEl = el.closest('article');
              if (articleEl?.id) {
                commentId = articleEl.id;
              } else {
                commentId = el.getAttribute('data-comment-id') || undefined;
              }

              // Extract author from user link
              let author: string | undefined;
              const authorLink = el.querySelector('a[href*="/users/"]');
              if (authorLink) {
                author = authorLink.textContent?.trim() || undefined;
              }

              // Extract content from p tags (excluding time/dialog classes)
              const pTags = el.querySelectorAll('p');
              let content = '';
              for (const p of pTags) {
                const classList = Array.from(p.classList || []);
                const isTimeOrDialog = classList.some(c =>
                  c.includes('time') || c.includes('dialog') || c.includes('meta')
                );
                if (!isTimeOrDialog) {
                  const text = p.textContent?.trim();
                  if (text) {
                    content += text + '\n';
                  }
                }
              }
              content = content.trim();

              // Extract timestamp
              let postedAt: string | undefined;
              const timeEl = el.querySelector('time');
              if (timeEl) {
                postedAt = timeEl.getAttribute('datetime') || timeEl.textContent?.trim() || undefined;
              }

              // Extract reactions - look for reaction buttons/counts
              const reactions: { empathized: number; understood: number; questioning: number } = {
                empathized: 0,
                understood: 0,
                questioning: 0
              };

              // Try to find reaction counts in various formats
              const reactionElements = el.querySelectorAll('[class*="reaction"], [class*="empathize"], [class*="agree"]');
              reactionElements.forEach(reactionEl => {
                const text = reactionEl.textContent || '';
                // Look for Japanese reaction labels
                if (text.includes('共感')) {
                  const match = text.match(/\d+/);
                  if (match) reactions.empathized = parseInt(match[0], 10);
                } else if (text.includes('なるほど')) {
                  const match = text.match(/\d+/);
                  if (match) reactions.understood = parseInt(match[0], 10);
                } else if (text.includes('うーん')) {
                  const match = text.match(/\d+/);
                  if (match) reactions.questioning = parseInt(match[0], 10);
                }
              });

              // Extract replies count
              let repliesCount = 0;
              const replyButton = el.querySelector('button');
              if (replyButton) {
                const replyText = replyButton.textContent || '';
                const match = replyText.match(/返信\s*(\d+)/);
                if (match) {
                  repliesCount = parseInt(match[1], 10);
                }
              }

              if (content.length > 0) {
                results.push({
                  commentId,
                  author,
                  content,
                  postedAt,
                  likes: reactions.empathized, // For backwards compatibility
                  repliesCount,
                  reactions,
                  replies: []
                });
              }
            });

            // Break if we found comments with this selector
            if (results.length > 0) {
              break;
            }
          }
        }

        return results;
      });

      log.articleScraper.info(reqId, 'HTML extraction completed', { commentCount: comments.length });
      return comments;
    } catch (error) {
      log.articleScraper.error(reqId, 'HTML extraction failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Expand truncated comments by clicking "続きを見る" (View more) links
   */
  private async expandTruncatedComments(
    page: any,
    comments: ScrapedComment[],
    reqId: string
  ): Promise<ScrapedComment[]> {
    try {
      const expandedComments = await page.evaluate((commentIds) => {
        const expanded: Array<{
          commentId?: string;
          content: string;
        }> = [];

        for (const id of commentIds) {
          const commentEl = id ? document.getElementById(id) : null;
          if (!commentEl) continue;

          // Look for "続きを見る" (View more) or similar expansion buttons
          const expandButton = commentEl.querySelector('button') as HTMLElement;
          const expandText = expandButton?.textContent || '';

          if (expandText.includes('続き') || expandText.includes('もっと見') || expandText.includes('展開')) {
            // Click to expand
            expandButton?.click();

            // Wait a bit for content to load
            // Note: We can't use async/await in evaluate, so we return what we have
            // The expanded content will be available on next extraction
          }

          // Extract updated content
          const pTags = commentEl.querySelectorAll('p');
          let content = '';
          for (const p of pTags) {
            const classList = Array.from(p.classList || []);
            const isTimeOrDialog = classList.some(c =>
              c.includes('time') || c.includes('dialog') || c.includes('meta')
            );
            if (!isTimeOrDialog) {
              const text = p.textContent?.trim();
              if (text) {
                content += text + '\n';
              }
            }
          }

          expanded.push({
            commentId: id,
            content: content.trim()
          });
        }

        return expanded;
      }, comments.map(c => c.commentId || ''));

      // Update comments with expanded content
      for (const expanded of expandedComments) {
        const comment = comments.find(c => c.commentId === expanded.commentId);
        if (comment && expanded.content.length > comment.content.length) {
          comment.content = expanded.content;
          log.articleScraper.debug(reqId, 'Comment expanded', {
            commentId: expanded.commentId,
            originalLength: comment.content.length,
            expandedLength: expanded.content.length
          });
        }
      }

      log.articleScraper.info(reqId, 'Truncated comments expanded', { expandedCount: expandedComments.length });
      return comments;
    } catch (error) {
      log.articleScraper.error(reqId, 'Failed to expand truncated comments', {
        error: error instanceof Error ? error.message : String(error)
      });
      return comments; // Return original comments on failure
    }
  }

  /**
   * Extract nested replies by clicking "返信" (Reply) buttons
   */
  private async extractNestedReplies(
    page: any,
    comments: ScrapedComment[],
    reqId: string
  ): Promise<ScrapedComment[]> {
    try {
      const commentsWithReplies = await page.evaluate((commentIds) => {
        const results: Array<{
          commentId?: string;
          replies: Array<{
            commentId?: string;
            author?: string;
            content: string;
            postedAt?: string;
            reactions?: {
              empathized: number;
              understood: number;
              questioning: number;
            };
          }>;
        }> = [];

        for (const id of commentIds) {
          if (!id) continue;

          const commentEl = document.getElementById(id);
          if (!commentEl) continue;

          // Look for reply button with "返信 X 件" text
          const buttons = commentEl.querySelectorAll('button');
          for (const button of buttons) {
            const text = button.textContent || '';
            const match = text.match(/返信\s*(\d+)/);

            if (match) {
              const replyCount = parseInt(match[1], 10);
              if (replyCount > 0) {
                // Click to expand replies
                (button as HTMLElement).click();

                // Wait for replies to load (brief pause)
                // In a real async scenario we'd wait, but in evaluate we do our best

                // Extract reply content
                const replies: Array<{
                  commentId?: string;
                  author?: string;
                  content: string;
                  postedAt?: string;
                  reactions?: {
                    empathized: number;
                    understood: number;
                    questioning: number;
                  };
                }> = [];

                // Look for nested reply elements
                // Replies are often in a nested container or dialog
                const replyElements = commentEl.querySelectorAll('article article, .reply, [class*="reply"]');

                replyElements.forEach(replyEl => {
                  // Extract reply ID
                  const replyArticle = replyEl.closest('article');
                  const replyId = replyArticle?.id || replyEl.getAttribute('data-comment-id') || undefined;

                  // Extract reply author
                  let author: string | undefined;
                  const authorLink = replyEl.querySelector('a[href*="/users/"]');
                  if (authorLink) {
                    author = authorLink.textContent?.trim() || undefined;
                  }

                  // Extract reply content
                  const pTags = replyEl.querySelectorAll('p');
                  let content = '';
                  for (const p of pTags) {
                    const classList = Array.from(p.classList || []);
                    const isTimeOrDialog = classList.some(c =>
                      c.includes('time') || c.includes('dialog') || c.includes('meta')
                    );
                    if (!isTimeOrDialog) {
                      const text = p.textContent?.trim();
                      if (text) {
                        content += text + '\n';
                      }
                    }
                  }

                  // Extract reply timestamp
                  let postedAt: string | undefined;
                  const timeEl = replyEl.querySelector('time');
                  if (timeEl) {
                    postedAt = timeEl.getAttribute('datetime') || timeEl.textContent?.trim() || undefined;
                  }

                  // Extract reply reactions
                  const reactions: { empathized: number; understood: number; questioning: number } = {
                    empathized: 0,
                    understood: 0,
                    questioning: 0
                  };

                  const reactionElements = replyEl.querySelectorAll('[class*="reaction"]');
                  reactionElements.forEach(reactionEl => {
                    const rText = reactionEl.textContent || '';
                    if (rText.includes('共感')) {
                      const rMatch = rText.match(/\d+/);
                      if (rMatch) reactions.empathized = parseInt(rMatch[0], 10);
                    } else if (rText.includes('なるほど')) {
                      const rMatch = rText.match(/\d+/);
                      if (rMatch) reactions.understood = parseInt(rMatch[0], 10);
                    } else if (rText.includes('うーん')) {
                      const rMatch = rText.match(/\d+/);
                      if (rMatch) reactions.questioning = parseInt(rMatch[0], 10);
                    }
                  });

                  if (content.trim().length > 0) {
                    replies.push({
                      commentId: replyId,
                      author,
                      content: content.trim(),
                      postedAt,
                      reactions
                    });
                  }
                });

                results.push({
                  commentId: id,
                  replies
                });
              }
            }
          }
        }

        return results;
      }, comments.map(c => c.commentId || ''));

      // Update comments with replies
      for (const item of commentsWithReplies) {
        const comment = comments.find(c => c.commentId === item.commentId);
        if (comment) {
          comment.replies = item.replies;
          log.articleScraper.debug(reqId, 'Replies extracted for comment', {
            commentId: item.commentId,
            replyCount: item.replies.length
          });
        }
      }

      log.articleScraper.info(reqId, 'Nested replies extracted', {
        commentsWithReplies: commentsWithReplies.length
      });
      return comments;
    } catch (error) {
      log.articleScraper.error(reqId, 'Failed to extract nested replies', {
        error: error instanceof Error ? error.message : String(error)
      });
      return comments; // Return original comments on failure
    }
  }

}
