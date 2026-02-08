import { beforeEach, describe, expect, it, vi } from 'vitest';
import puppeteer from '@cloudflare/puppeteer';
import { YahooNewsScraper } from '../../../services/news-scraper.js';

vi.mock('@cloudflare/puppeteer', () => ({
  default: {
    launch: vi.fn(),
  },
}));

describe('YahooNewsScraper', () => {
  let scraper: YahooNewsScraper;
  let mockPage: any;
  let mockBrowser: any;

  beforeEach(() => {
    scraper = new YahooNewsScraper();

    mockPage = {
      setUserAgent: vi.fn().mockResolvedValue(undefined),
      goto: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as any);
  });

  it('scrapes, filters pickup URLs, and deduplicates by URL', async () => {
    mockPage.evaluate.mockResolvedValue([
      { title: 'Pickup 1', url: 'https://news.yahoo.co.jp/pickup/1234567' },
      { title: 'Pickup 1 Duplicate', url: 'https://news.yahoo.co.jp/pickup/1234567' },
      { title: 'Article', url: 'https://news.yahoo.co.jp/articles/abc' },
    ]);

    const result = await scraper.scrape({} as any);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://news.yahoo.co.jp/pickup/1234567');
    expect(mockPage.goto).toHaveBeenCalledWith(
      'https://news.yahoo.co.jp/topics/top-picks',
      expect.objectContaining({ timeout: 20000 })
    );
  });

  it('drops non-absolute URLs after extraction', async () => {
    mockPage.evaluate.mockResolvedValue([
      { title: 'Relative pickup', url: '/pickup/9999999' },
    ]);

    const result = await scraper.scrape({} as any);

    expect(result).toHaveLength(0);
  });

  it('throws when browser binding is missing', async () => {
    await expect(scraper.scrape(null)).rejects.toThrow('Browser binding is not available');
  });

  it('propagates scraping errors and always closes browser resources', async () => {
    mockPage.goto.mockRejectedValue(new Error('Network error'));

    await expect(scraper.scrape({} as any)).rejects.toThrow('Network error');
  });
});
