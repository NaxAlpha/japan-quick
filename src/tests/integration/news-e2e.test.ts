/**
 * Integration tests for News API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';

describe('News API Integration Tests', () => {
  beforeEach(async () => {
    // Clear cache before each test
    await env.NEWS_CACHE.delete('yahoo-japan-top-picks');
  });

  it('should return valid response from API', async () => {
    const response = await fetch('http://localhost/api/news/yahoo-japan');

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('topPicks');
    expect(data).toHaveProperty('scrapedAt');
    expect(data).toHaveProperty('cached');
    expect(Array.isArray(data.topPicks)).toBe(true);
  });

  it('should return top picks with required fields', async () => {
    const response = await fetch('http://localhost/api/news/yahoo-japan');
    const data = await response.json();

    if (data.topPicks.length > 0) {
      const topPick = data.topPicks[0];
      expect(topPick).toHaveProperty('title');
      expect(topPick).toHaveProperty('url');
      expect(topPick.url).toMatch(/^https?:\/\//);
    }
  });

  it('should cache subsequent requests', async () => {
    // First request
    const response1 = await fetch('http://localhost/api/news/yahoo-japan');
    const data1 = await response1.json();

    // Second request should be cached
    const response2 = await fetch('http://localhost/api/news/yahoo-japan');
    const data2 = await response2.json();

    expect(data1.cached).toBe(false);
    expect(data2.cached).toBe(true);
  });

  it('should auto-save fresh scrapes to D1', async () => {
    // Clear any existing snapshots for clean test
    await env.DB.prepare('DELETE FROM news_snapshots').run();

    // Fresh scrape (cache was cleared in beforeEach)
    const response = await fetch('http://localhost/api/news/yahoo-japan');
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.cached).toBe(false);

    // Verify snapshot was saved to D1
    const snapshots = await env.DB.prepare('SELECT * FROM news_snapshots').all();
    expect(snapshots.results.length).toBeGreaterThan(0);

    const snapshot = snapshots.results[0];
    expect(snapshot.snapshot_name).toMatch(/^article-snapshot-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/);
    expect(snapshot.captured_at).toBe(data.scrapedAt);
  });

  it('should not save cached responses to D1', async () => {
    // Clear any existing snapshots for clean test
    await env.DB.prepare('DELETE FROM news_snapshots').run();

    // First request - fresh scrape, should save to D1
    const response1 = await fetch('http://localhost/api/news/yahoo-japan');
    expect(response1.status).toBe(200);

    let snapshots = await env.DB.prepare('SELECT * FROM news_snapshots').all();
    const snapshotCount1 = snapshots.results.length;
    expect(snapshotCount1).toBe(1); // One snapshot from fresh scrape

    // Second request - cached, should NOT create new snapshot
    const response2 = await fetch('http://localhost/api/news/yahoo-japan');
    expect(response2.status).toBe(200);

    snapshots = await env.DB.prepare('SELECT * FROM news_snapshots').all();
    const snapshotCount2 = snapshots.results.length;
    expect(snapshotCount2).toBe(snapshotCount1); // No new snapshot created
  });
});
