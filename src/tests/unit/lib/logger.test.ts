import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../../../lib/logger.js';

describe('logger error overloads', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('supports reqId + message + error + context', () => {
    const logger = createLogger('TestLogger');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.error('req-123', 'Operation failed', new Error('failure'), {
      videoId: 42,
      tags: ['a', 'b'],
      metadata: { phase: 'upload' },
    });

    expect(consoleSpy).toHaveBeenCalledOnce();
    const line = consoleSpy.mock.calls[0][0] as string;
    expect(line).toContain('[req-123]');
    expect(line).toContain('[ERROR]');
    expect(line).toContain('[TestLogger]');
    expect(line).toContain('Operation failed');
    expect(line).toContain('videoId=42');
    expect(line).toContain('error=failure');
    expect(line).toContain('tags=["a","b"]');
    expect(line).toContain('metadata={"phase":"upload"}');
  });
});
