import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { newsRoutes } from '../../../routes/news.js';

describe('News Routes', () => {
  let env: any;
  let app: Hono;

  beforeEach(() => {
    env = {
      NEWS_SCRAPER_WORKFLOW: {
        create: vi.fn(),
        get: vi.fn(),
      },
      SCHEDULED_REFRESH_WORKFLOW: {
        create: vi.fn(),
      },
      ARTICLE_RESCRAPE_WORKFLOW: {
        create: vi.fn(),
      },
      DB: {
        prepare: vi.fn(),
      },
    };

    app = new Hono();
    app.route('/', newsRoutes);
  });

  it('creates a news workflow with default params', async () => {
    env.NEWS_SCRAPER_WORKFLOW.create.mockResolvedValue({ id: 'wf-news-1' });

    const response = await app.request(
      '/trigger',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      env
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.workflowId).toBe('wf-news-1');
    expect(env.NEWS_SCRAPER_WORKFLOW.create).toHaveBeenCalledWith({
      params: { skipCache: false },
    });
  });

  it('returns not found when status is requested for an unknown workflow', async () => {
    env.NEWS_SCRAPER_WORKFLOW.get.mockResolvedValue(null);

    const response = await app.request('/status/missing-workflow', {}, env);
    const payload = await response.json() as any;

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('Workflow');
  });

  it('returns 400 when a workflow result is requested before completion', async () => {
    env.NEWS_SCRAPER_WORKFLOW.get.mockResolvedValue({
      id: 'wf-news-2',
      status: vi.fn().mockResolvedValue({ status: 'running' }),
    });

    const response = await app.request('/result/wf-news-2', {}, env);
    const payload = await response.json() as any;

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('not yet complete');
  });

  it('returns latest snapshot augmented with article statuses', async () => {
    const snapshotData = {
      topPicks: [
        { title: 'A', url: 'https://news.yahoo.co.jp/pickup/1234567' },
        { title: 'B', url: 'https://news.yahoo.co.jp/pickup/7654321' },
      ],
      scrapedAt: '2026-02-08T00:00:00.000Z',
      cached: false,
    };

    env.DB.prepare = vi.fn((sql: string) => {
      if (sql.includes('FROM news_snapshots')) {
        return {
          first: vi.fn().mockResolvedValue({
            id: 1,
            captured_at: '2026-02-08T00:00:01.000Z',
            snapshot_name: 'snapshot-1',
            data: JSON.stringify(snapshotData),
          }),
        };
      }

      if (sql.includes('FROM articles WHERE pick_id IN')) {
        return {
          bind: vi.fn(() => ({
            all: vi.fn().mockResolvedValue({
              results: [{ pick_id: '1234567', status: 'scraped_v1' }],
            }),
          })),
        };
      }

      throw new Error(`Unexpected SQL in test: ${sql}`);
    });

    const response = await app.request('/latest', {}, env);
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.snapshot.data.topPicks[0].pickId).toBe('1234567');
    expect(payload.snapshot.data.topPicks[0].articleStatus).toBe('scraped_v1');
    expect(payload.snapshot.data.topPicks[1].pickId).toBe('7654321');
    expect(payload.snapshot.data.topPicks[1].articleStatus).toBeUndefined();
  });

  it('terminates an existing workflow', async () => {
    const terminate = vi.fn().mockResolvedValue(undefined);
    env.NEWS_SCRAPER_WORKFLOW.get.mockResolvedValue({ terminate });

    const response = await app.request('/cancel/wf-news-terminate', { method: 'POST' }, env);
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.message).toContain('terminated');
    expect(terminate).toHaveBeenCalledOnce();
  });
});
