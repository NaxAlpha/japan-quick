/**
 * Unit tests for YahooNewsScraper
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YahooNewsScraper } from '../../../services/news-scraper.js';

describe('YahooNewsScraper', () => {
  let scraper: YahooNewsScraper;
  let mockBrowser: any;
  let mockPage: any;

  beforeEach(() => {
    scraper = new YahooNewsScraper();
    mockPage = {
      setUserAgent: vi.fn(),
      goto: vi.fn(),
      evaluate: vi.fn(),
      close: vi.fn()
    };
    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage)
    };
  });

  it('should scrape articles from Yahoo News Japan', async () => {
    const mockArticles = [
      {
        title: 'Test Article 1',
        url: 'https://news.yahoo.co.jp/pickup/1',
        thumbnailUrl: 'https://example.com/img1.jpg',
        publishedAt: '1/19(月) 12:31'
      },
      {
        title: 'Test Article 2',
        url: 'https://news.yahoo.co.jp/pickup/2',
        thumbnailUrl: 'https://example.com/img2.jpg',
        publishedAt: '1/19(月) 12:07'
      }
    ];
    mockPage.evaluate.mockResolvedValue(mockArticles);

    const result = await scraper.scrape(mockBrowser);

    expect(result).toEqual(mockArticles);
    expect(mockPage.setUserAgent).toHaveBeenCalledWith(expect.stringContaining('JapanQuick'));
    expect(mockPage.goto).toHaveBeenCalledWith(
      'https://news.yahoo.co.jp/topics/top-picks',
      expect.objectContaining({ timeout: 20000 })
    );
  });

  it('should convert relative URLs to absolute', async () => {
    const mockArticles = [
      { title: 'Test', url: '/articles/123' }
    ];
    mockPage.evaluate.mockResolvedValue(mockArticles);

    const result = await scraper.scrape(mockBrowser);

    expect(result[0].url).toBe('https://news.yahoo.co.jp/articles/123');
  });

  it('should deduplicate articles by URL', async () => {
    const mockArticles = [
      { title: 'Article 1', url: 'https://example.com/1' },
      { title: 'Article 2', url: 'https://example.com/1' }, // Duplicate
      { title: 'Article 3', url: 'https://example.com/2' }
    ];
    mockPage.evaluate.mockResolvedValue(mockArticles);

    const result = await scraper.scrape(mockBrowser);

    expect(result).toHaveLength(2);
  });

  it('should filter articles without valid URLs', async () => {
    const mockArticles = [
      { title: 'Valid', url: 'https://example.com' },
      { title: 'Invalid', url: '' },
      { title: 'Invalid', url: 'not-a-url' }
    ];
    mockPage.evaluate.mockResolvedValue(mockArticles);

    const result = await scraper.scrape(mockBrowser);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com');
  });

  it('should handle scraping errors gracefully', async () => {
    mockPage.goto.mockRejectedValue(new Error('Network error'));

    await expect(scraper.scrape(mockBrowser)).rejects.toThrow('Network error');
    expect(mockPage.close).toHaveBeenCalled();
  });

  it('should handle empty results', async () => {
    mockPage.evaluate.mockResolvedValue([]);

    const result = await scraper.scrape(mockBrowser);

    expect(result).toEqual([]);
  });
});
