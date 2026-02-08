import { describe, expect, it, vi } from 'vitest';
import { runRoute } from '../../../lib/route-helpers.js';

function createLoggerStub() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('runRoute', () => {
  it('logs lifecycle and preserves successful response status', async () => {
    const logger = createLoggerStub();

    const response = await runRoute(
      logger as any,
      'req-1',
      { method: 'GET', path: '/ok' },
      async () => new Response('ok', { status: 201 })
    );

    expect(response.status).toBe(201);
    expect(logger.info).toHaveBeenCalledWith('req-1', 'Request received', {
      method: 'GET',
      path: '/ok',
    });
    expect(logger.info).toHaveBeenLastCalledWith(
      'req-1',
      'Request completed',
      expect.objectContaining({ status: 201 })
    );
  });

  it('converts thrown errors to server responses and logs them', async () => {
    const logger = createLoggerStub();

    const response = await runRoute(
      logger as any,
      'req-2',
      { method: 'POST', path: '/fail' },
      async () => {
        throw new Error('boom');
      }
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('boom');
    expect(logger.error).toHaveBeenCalledWith('req-2', 'Request failed', expect.any(Error));
    expect(logger.info).toHaveBeenLastCalledWith(
      'req-2',
      'Request completed',
      expect.objectContaining({ status: 500 })
    );
  });
});
