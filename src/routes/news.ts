/**
 * News API routes
 * GET /api/news/yahoo-japan - Fetch Yahoo News Japan top picks
 *                          - Fresh scrapes are auto-saved to D1 database
 */

import { Hono } from 'hono';
import { YahooNewsScraper } from '../services/news-scraper.js';
import type { YahooNewsResponse, Env } from '../types/news.js';

// D1Database is available globally in Cloudflare Workers
// Use the Env type for proper typing
type D1Type = Env['Bindings']['DB'];

const newsRoutes = new Hono<{ Bindings: Env['Bindings'] }>();

const CACHE_KEY = 'yahoo-japan-top-picks';
const CACHE_TTL = 300; // 5 minutes

// Helper to save news data to D1
async function saveNewsSnapshot(db: D1Type, newsData: YahooNewsResponse): Promise<string> {
  const now = new Date();
  const snapshotName = `article-snapshot-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

  try {
    await db.prepare(
      'INSERT INTO news_snapshots (captured_at, snapshot_name, data) VALUES (?, ?, ?)'
    )
      .bind(newsData.scrapedAt, snapshotName, JSON.stringify(newsData))
      .run();
  } catch (error) {
    // Log the error but don't fail the request - the news is still cached and returned
    console.error('Failed to save news snapshot to D1:', error instanceof Error ? error.message : 'Unknown error');
  }

  return snapshotName;
}

newsRoutes.get('/yahoo-japan', async (c) => {
  // Check cache first
  try {
    const cached = await c.env.NEWS_CACHE.get(CACHE_KEY, 'json');
    if (cached && typeof cached === 'object' && 'topPicks' in cached && Array.isArray(cached.topPicks)) {
      return c.json({
        ...cached,
        cached: true
      } as YahooNewsResponse);
    }
  } catch (error) {
    // Cached data is malformed, log and continue to fetch fresh data
    console.error('Failed to parse cached data:', error instanceof Error ? error.message : 'Unknown error');
  }

  // Scrape fresh data
  const scraper = new YahooNewsScraper();
  const topPicks = await scraper.scrape(c.env.BROWSER);

  const response: YahooNewsResponse = {
    topPicks,
    scrapedAt: new Date().toISOString(),
    cached: false
  };

  // Cache for 5 minutes
  await c.env.NEWS_CACHE.put(CACHE_KEY, JSON.stringify(response), {
    expirationTtl: CACHE_TTL
  });

  // Auto-save fresh scrapes to D1
  await saveNewsSnapshot(c.env.DB, response);

  return c.json(response);
});

export { newsRoutes };
