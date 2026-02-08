import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { articleRoutes } from '../../../routes/articles.js';

describe('Article Routes', () => {
  let env: any;
  let app: Hono;

  beforeEach(() => {
    env = {
      DB: {
        prepare: vi.fn(),
      },
      ARTICLE_SCRAPER_WORKFLOW: {
        create: vi.fn(),
        get: vi.fn(),
      },
    };

    app = new Hono();
    app.route('/', articleRoutes);
  });

  it('returns 404 when article is missing', async () => {
    env.DB.prepare.mockReturnValue({
      bind: vi.fn(() => ({
        first: vi.fn().mockResolvedValue(null),
      })),
    });

    const response = await app.request('/does-not-exist', {}, env);
    const payload = await response.json() as any;

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('Article');
  });

  it('triggers article workflow with default isRescrape=false', async () => {
    env.ARTICLE_SCRAPER_WORKFLOW.create.mockResolvedValue({ id: 'wf-article-1' });

    const response = await app.request(
      '/trigger/1234567',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      env
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.workflowId).toBe('wf-article-1');
    expect(payload.pickId).toBe('1234567');
    expect(env.ARTICLE_SCRAPER_WORKFLOW.create).toHaveBeenCalledWith({
      params: {
        pickId: '1234567',
        isRescrape: false,
      },
    });
  });

  it('returns workflow status output', async () => {
    env.ARTICLE_SCRAPER_WORKFLOW.get.mockResolvedValue({
      id: 'wf-article-2',
      status: vi.fn().mockResolvedValue({
        status: 'complete',
        output: { success: true, pickId: '7654321', status: 'scraped_v1' },
      }),
    });

    const response = await app.request('/status/wf-article-2', {}, env);
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.workflowId).toBe('wf-article-2');
    expect(payload.status).toBe('complete');
    expect(payload.output.pickId).toBe('7654321');
  });
});
