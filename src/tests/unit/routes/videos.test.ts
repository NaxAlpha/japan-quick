import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { videoRoutes } from '../../../routes/videos.js';

describe('Video Routes policy gating', () => {
  let env: any;
  let app: Hono;

  beforeEach(() => {
    env = {
      DB: {
        prepare: vi.fn(),
      },
      YOUTUBE_UPLOAD_WORKFLOW: {
        create: vi.fn(),
      },
      ASSET_GENERATION_WORKFLOW: {
        create: vi.fn(),
      },
    };

    app = new Hono();
    app.route('/', videoRoutes);
  });

  it('blocks manual YouTube upload trigger when policy is BLOCK', async () => {
    env.DB.prepare = vi.fn((sql: string) => {
      if (sql.includes('SELECT * FROM videos WHERE id = ?')) {
        return {
          bind: vi.fn(() => ({
            first: vi.fn().mockResolvedValue({
              id: 1,
              render_status: 'rendered',
              youtube_upload_status: 'pending',
              policy_overall_status: 'BLOCK',
              policy_block_reasons: JSON.stringify(['MISINFO_SENSITIVE_CLAIMS: claim not supported'])
            }),
          })),
        };
      }

      if (sql.includes("SET youtube_upload_status = 'blocked'")) {
        return {
          bind: vi.fn(() => ({
            run: vi.fn().mockResolvedValue({}),
          })),
        };
      }

      throw new Error(`Unexpected SQL in test: ${sql}`);
    });

    const response = await app.request('/1/youtube-upload', { method: 'POST' }, env);
    const payload = await response.json() as any;

    expect(response.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('Policy BLOCK');
    expect(env.YOUTUBE_UPLOAD_WORKFLOW.create).not.toHaveBeenCalled();
  });

  it('uses public privacy when policy is CLEAN for manual upload trigger', async () => {
    env.DB.prepare = vi.fn((sql: string) => {
      if (sql.includes('SELECT * FROM videos WHERE id = ?')) {
        return {
          bind: vi.fn(() => ({
            first: vi.fn().mockResolvedValue({
              id: 1,
              render_status: 'rendered',
              youtube_upload_status: 'pending',
              policy_overall_status: 'CLEAN',
              policy_block_reasons: '[]'
            }),
          })),
        };
      }

      throw new Error(`Unexpected SQL in test: ${sql}`);
    });

    env.YOUTUBE_UPLOAD_WORKFLOW.create.mockResolvedValue({ id: 'wf-youtube-clean' });

    const response = await app.request('/1/youtube-upload', { method: 'POST' }, env);
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(env.YOUTUBE_UPLOAD_WORKFLOW.create).toHaveBeenCalledWith({
      id: expect.stringContaining('youtube-upload-1-'),
      params: {
        videoId: 1,
        privacy: 'public'
      }
    });
  });

  it('blocks manual asset generation trigger when policy is BLOCK', async () => {
    env.DB.prepare = vi.fn((sql: string) => {
      if (sql.includes('SELECT script_status, asset_status, image_model, tts_model, policy_overall_status, policy_block_reasons')) {
        return {
          bind: vi.fn(() => ({
            first: vi.fn().mockResolvedValue({
              script_status: 'generated',
              asset_status: 'pending',
              image_model: 'gemini-3-pro-image-preview',
              tts_model: 'gemini-2.5-flash-preview-tts',
              policy_overall_status: 'BLOCK',
              policy_block_reasons: JSON.stringify(['VISUAL_MISLEADING_THUMBNAIL: fabricated event'])
            }),
          })),
        };
      }

      throw new Error(`Unexpected SQL in test: ${sql}`);
    });

    const response = await app.request('/1/generate-assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    }, env);
    const payload = await response.json() as any;

    expect(response.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('Policy BLOCK');
    expect(env.ASSET_GENERATION_WORKFLOW.create).not.toHaveBeenCalled();
  });
});
