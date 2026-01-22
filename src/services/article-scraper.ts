/**
 * Yahoo News Article Scraper Service
 * Browser-based scraping for article content, images, and comments from Yahoo News Japan
 */

import puppeteer from '@cloudflare/puppeteer';
import type { ScrapedArticleData, ScrapedComment } from '../types/article.js';

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
  async scrapePickupPage(browser: any, pickId: string): Promise<PickupScrapeResult> {
    const pickupUrl = `https://news.yahoo.co.jp/pickup/${pickId}`;
    return await this.scrapePickupWithBrowser(browser, pickupUrl);
  }

  private async scrapePickupWithBrowser(browserBinding: any, pickupUrl: string): Promise<PickupScrapeResult> {
    if (!browserBinding) {
      throw new Error('Browser binding is not available. Browser rendering is required for scraping.');
    }

    const browser = await puppeteer.launch(browserBinding);
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.goto(pickupUrl, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT_MS
    });

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

    await page.close();
    await browser.disconnect();
    return result;
  }

  /**
   * Scrape the article page content
   */
  async scrapeArticlePage(browser: any, articleUrl: string): Promise<ScrapedArticleData> {
    return await this.scrapeArticleWithBrowser(browser, articleUrl);
  }

  private async scrapeArticleWithBrowser(browserBinding: any, articleUrl: string): Promise<ScrapedArticleData> {
    if (!browserBinding) {
      throw new Error('Browser binding is not available. Browser rendering is required for scraping.');
    }

    const browser = await puppeteer.launch(browserBinding);
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.goto(articleUrl, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT_MS
    });

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

    // If there are multiple pages, scrape them too
    if (firstPageData.pageCount > 1) {
      const allContent = [firstPageData.content];
      const allContentText = [firstPageData.contentText || ''];
      const allImages = [...firstPageData.images];

      for (let pageNum = 2; pageNum <= firstPageData.pageCount; pageNum++) {
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
      }

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
  async scrapeCommentsPage(browser: any, articleUrl: string): Promise<ScrapedComment[]> {
    const commentsUrl = `${articleUrl}/comments`;
    return await this.scrapeCommentsWithBrowser(browser, commentsUrl);
  }

  private async scrapeCommentsWithBrowser(browserBinding: any, commentsUrl: string): Promise<ScrapedComment[]> {
    if (!browserBinding) {
      throw new Error('Browser binding is not available. Browser rendering is required for scraping.');
    }

    const browser = await puppeteer.launch(browserBinding);
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    try {
      await page.goto(commentsUrl, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT_MS
      });
    } catch (error) {
      // Comments page might not exist
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

    await page.close();
    await browser.disconnect();
    return comments;
  }

  /**
   * Full scrape: pickup page -> article -> comments
   */
  async scrapeFullArticle(browser: any, pickId: string): Promise<FullScrapeResult> {
    // Step 1: Scrape pickup page to get article URL
    const pickupResult = await this.scrapePickupPage(browser, pickId);

    if (pickupResult.isExternal || !pickupResult.articleUrl) {
      return { isExternal: true };
    }

    // Step 2: Scrape article content
    const article = await this.scrapeArticlePage(browser, pickupResult.articleUrl);

    // Step 3: Scrape comments
    const comments = await this.scrapeCommentsPage(browser, pickupResult.articleUrl);

    return {
      isExternal: false,
      article,
      comments
    };
  }
}
