/**
 * Yahoo News Japan scraper service
 * Scrapes top picks from https://news.yahoo.co.jp/topics/top-picks
 * Uses Puppeteer in production, falls back to HTTP fetch in local development
 */

import type { YahooNewsTopPick } from '../types/news.js';

const TOP_PICKS_URL = 'https://news.yahoo.co.jp/topics/top-picks';
const USER_AGENT = 'Mozilla/5.0 (compatible; JapanQuick/1.0)';

// Filter to only include pickup URLs (e.g., https://news.yahoo.co.jp/pickup/XXXXXXX)
function isPickupUrl(url: string): boolean {
  return /^https?:\/\/news\.yahoo\.co\.jp\/pickup\/\d+$/.test(url);
}

// Helper function to filter items by pickup URL
function filterPickupItems(items: YahooNewsTopPick[]): YahooNewsTopPick[] {
  return items.filter(item => isPickupUrl(item.url));
}

// Helper function to deduplicate items by URL
function deduplicateByUrl(items: YahooNewsTopPick[]): YahooNewsTopPick[] {
  const uniqueTopPicks = new Map<string, YahooNewsTopPick>();
  for (const item of items) {
    if (item.url.startsWith('http')) {
      uniqueTopPicks.set(item.url, item);
    }
  }
  return Array.from(uniqueTopPicks.values());
}

// Parse HTML string to extract top picks
function parseTopPicksFromHtml(html: string): YahooNewsTopPick[] {
  const items: YahooNewsTopPick[] = [];

  // Parse links with their content using regex
  // Match <li> elements containing <a> tags with news items
  const liPattern = /<li[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<\/li>/g;
  let match;

  while ((match = liPattern.exec(html)) !== null) {
    const liContent = match[0];
    const hrefMatch = /<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/.exec(liContent);

    if (hrefMatch) {
      const url = hrefMatch[1];
      const absoluteUrl = url.startsWith('http') ? url : `https://news.yahoo.co.jp${url}`;

      // Extract title from the link content
      // Find text content excluding the time element
      const timeMatch = /<time[^>]*>([^<]+)<\/time>/.exec(liContent);
      const timeText = timeMatch ? timeMatch[1].trim() : undefined;

      // Extract title by getting all text between the tags and removing the time
      const textContent = liContent
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      let title = textContent;
      if (timeText && title.includes(timeText)) {
        title = title.replace(timeText, '').trim();
      }

      // Extract thumbnail URL
      const imgMatch = /<img[^>]*src="([^"]+)"[^>]*>/.exec(liContent);
      const thumbnailUrl = imgMatch ? imgMatch[1] : undefined;

      // Only include pickup URLs
      if (title && absoluteUrl && isPickupUrl(absoluteUrl)) {
        items.push({
          title,
          url: absoluteUrl,
          thumbnailUrl,
          publishedAt: timeText
        });
      }
    }
  }

  return items;
}

export class YahooNewsScraper {
  async scrape(browser: any): Promise<YahooNewsTopPick[]> {
    // Try using browser binding first (for production)
    // Fall back to HTTP fetch for local development
    try {
      // Check if browser binding is available and functional
      if (browser && typeof browser.newPage === 'function') {
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.goto(TOP_PICKS_URL, {
          waitUntil: 'domcontentloaded',
          timeout: 20000
        });

        const topPicks = await page.evaluate(() => {
          const items: Array<{
            title: string;
            url: string;
            thumbnailUrl?: string;
            publishedAt?: string;
          }> = [];

          const listItems = document.querySelectorAll('ul.newsFeed_list > li');

          listItems.forEach((li) => {
            const linkEl = li.querySelector('a');
            if (!linkEl) return;

            const url = linkEl.getAttribute('href');
            if (!url) return;

            const absoluteUrl = url.startsWith('http')
              ? url
              : `https://news.yahoo.co.jp${url}`;

            const imgEl = linkEl.querySelector('img');
            const thumbnailUrl = imgEl?.getAttribute('src') || undefined;

            const timeEl = linkEl.querySelector('time');
            const timeText = timeEl?.textContent?.trim() || '';

            let fullText = linkEl.textContent?.trim() || '';
            if (timeText && fullText.includes(timeText)) {
              fullText = fullText.replace(timeText, '').trim();
            }

            const title = fullText;

            if (title && absoluteUrl) {
              items.push({
                title,
                url: absoluteUrl,
                thumbnailUrl,
                publishedAt: timeText || undefined
              });
            }
          });

          return items;
        });

        await page.close();

        // Filter and deduplicate using shared helpers
        return deduplicateByUrl(filterPickupItems(topPicks));
      }
    } catch (error) {
      // Browser binding not available or failed, fall back to HTTP fetch
      // Log the full error for debugging
      console.error('Browser mode failed, using HTTP fetch fallback:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Fallback: Use HTTP fetch with HTML parsing
    // Add timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

    try {
      const response = await fetch(TOP_PICKS_URL, {
        headers: {
          'User-Agent': USER_AGENT
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const topPicks = parseTopPicksFromHtml(html);

      // Filter and deduplicate using shared helpers
      return deduplicateByUrl(filterPickupItems(topPicks));
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('HTTP fetch request timed out after 20 seconds');
      }
      throw error;
    }
  }
}
