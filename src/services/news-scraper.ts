/**
 * Yahoo News Japan scraper service
 * Scrapes top picks from https://news.yahoo.co.jp/topics/top-picks
 * Uses Cloudflare Puppeteer for browser rendering
 */

import puppeteer from '@cloudflare/puppeteer';
import type { YahooNewsTopPick } from '../types/news.js';
import { log } from '../lib/logger.js';
import { SCRAPING, URL_PATTERNS } from '../lib/constants.js';

// Filter to only include pickup URLs (e.g., https://news.yahoo.co.jp/pickup/XXXXXXX)
function isPickupUrl(url: string): boolean {
  return URL_PATTERNS.YAHOO_PICKUP.test(url);
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

export class YahooNewsScraper {
  async scrape(browserBinding: any): Promise<YahooNewsTopPick[]> {
    log.newsScraper.info('News scraping started');
    const startTime = Date.now();

    try {
      // Browser-only scraping - no HTTP fallback
      if (!browserBinding) {
        throw new Error('Browser binding is not available. Browser rendering is required for scraping.');
      }

      const browser = await puppeteer.launch(browserBinding);
      const page = await browser.newPage();
      await page.setUserAgent(SCRAPING.USER_AGENT);

      log.newsScraper.info('Navigating to page', { url: URL_PATTERNS.YAHOO_TOP_PICKS });
      await page.goto(URL_PATTERNS.YAHOO_TOP_PICKS, {
        waitUntil: 'domcontentloaded',
        timeout: SCRAPING.NEWS_TIMEOUT_MS
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

      log.newsScraper.info('News list extraction completed', { itemCount: topPicks.length });

      await page.close();
      await browser.disconnect();

      // Filter and deduplicate using shared helpers
      const originalCount = topPicks.length;
      const filteredPickupItems = filterPickupItems(topPicks);
      const filteredCount = filteredPickupItems.length;
      log.newsScraper.info('Filtering results', { originalCount, filteredCount });

      const finalResult = deduplicateByUrl(filteredPickupItems);
      const dedupedCount = finalResult.length;
      log.newsScraper.info('Deduplication completed', { filteredCount, dedupedCount });

      const durationMs = Date.now() - startTime;
      log.newsScraper.info('News scraping completed', { articleCount: dedupedCount, durationMs });

      return finalResult;
    } catch (error) {
      log.newsScraper.error('News scraping failed', error as Error);
      throw error;
    }
  }
}
