/**
 * Unit tests for news routes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { newsRoutes } from '../../../routes/news.js';
import { YahooNewsScraper } from '../../../services/news-scraper.js';

describe('News Routes', () => {
  let mockEnv: any;
  let mockScraper: any;

  beforeEach(async () => {
    mockEnv = {
      NEWS_CACHE: {
        get: vi.fn(),
        put: vi.fn()
      },
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            run: vi.fn()
          }))
        }))
      },
      BROWSER: {}
    };

    mockScraper = {
      scrape: vi.fn()
    };

    const newsScraperModule = await import('../../../services/news-scraper.js');
    vi.spyOn(newsScraperModule, 'YahooNewsScraper')
      .mockImplementation(() => mockScraper);
  });

  it('should return cached news if available', async () => {
    const cachedData = {
      topPicks: [
        { title: 'Cached Article', url: 'https://example.com/1' }
      ],
      scrapedAt: new Date().toISOString()
    };

    mockEnv.NEWS_CACHE.get.mockResolvedValue(JSON.stringify(cachedData));

    const app = new Hono();
    app.route('/', newsRoutes);

    const response = await app.request('/yahoo-japan', {}, mockEnv);
    const data = await response.json();

    expect(data.cached).toBe(true);
    expect(data.topPicks).toHaveLength(1);
    expect(data.topPicks[0].title).toBe('Cached Article');
    expect(mockScraper.scrape).not.toHaveBeenCalled();
    // Should NOT save to D1 when returning cached data
    expect(mockEnv.DB.prepare).not.toHaveBeenCalled();
  });

  it('should scrape fresh news if cache is empty', async () => {
    mockEnv.NEWS_CACHE.get.mockResolvedValue(null);
    mockScraper.scrape.mockResolvedValue([
      { title: 'Fresh Article', url: 'https://example.com/2' }
    ]);

    const app = new Hono();
    app.route('/', newsRoutes);

    const response = await app.request('/yahoo-japan', {}, mockEnv);
    const data = await response.json();

    expect(data.cached).toBe(false);
    expect(data.topPicks).toHaveLength(1);
    expect(mockScraper.scrape).toHaveBeenCalledWith(mockEnv.BROWSER);
    expect(mockEnv.NEWS_CACHE.put).toHaveBeenCalledWith(
      'yahoo-japan-top-picks',
      expect.stringContaining('Fresh Article'),
      expect.any(Object)
    );
  });

  it('should auto-save fresh scrapes to D1', async () => {
    mockEnv.NEWS_CACHE.get.mockResolvedValue(null);
    mockScraper.scrape.mockResolvedValue([
      { title: 'Fresh Article', url: 'https://example.com/2' }
    ]);

    const app = new Hono();
    app.route('/', newsRoutes);

    const response = await app.request('/yahoo-japan', {}, mockEnv);

    expect(response.status).toBe(200);
    // Should save to D1 when scraping fresh data
    expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
      'INSERT INTO news_snapshots (captured_at, snapshot_name, data) VALUES (?, ?, ?)'
    );
  });

  it('should return valid response structure', async () => {
    mockEnv.NEWS_CACHE.get.mockResolvedValue(null);
    mockScraper.scrape.mockResolvedValue([]);

    const app = new Hono();
    app.route('/', newsRoutes);

    const response = await app.request('/yahoo-japan', {}, mockEnv);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('topPicks');
    expect(data).toHaveProperty('scrapedAt');
    expect(data).toHaveProperty('cached');
    expect(Array.isArray(data.topPicks)).toBe(true);
  });

  it('should cache scraped data with TTL', async () => {
    mockEnv.NEWS_CACHE.get.mockResolvedValue(null);
    mockScraper.scrape.mockResolvedValue([]);

    const app = new Hono();
    app.route('/', newsRoutes);

    await app.request('/yahoo-japan', {}, mockEnv);

    expect(mockEnv.NEWS_CACHE.put).toHaveBeenCalledWith(
      'yahoo-japan-top-picks',
      expect.any(String),
      expect.objectContaining({ expirationTtl: 2100 })
    );
  });
});
