import { describe, expect, it } from 'vitest';
import { buildEnhancedSelectionPrompt } from '../../../lib/prompts.js';
import type { AIArticleInputWithContent, PastVideoContext, SelectionSchedulingContext } from '../../../types/video.js';

describe('buildEnhancedSelectionPrompt', () => {
  it('includes 36h history guidance, soft 4/4/4 mix targets, and multi-story 2-6 range', () => {
    const articles: AIArticleInputWithContent[] = [
      {
        index: '1234',
        title: 'Test article',
        dateTime: '2026-02-08T10:00:00Z',
        source: 'Yahoo',
        content: '<p>Test content for selection prompt coverage.</p>',
        contentLength: 1200,
        status: 'scraped_v2'
      }
    ];

    const pastVideos: PastVideoContext[] = [
      {
        id: 1,
        title: 'Past video',
        articles: ['Past story'],
        videoType: 'short',
        videoFormat: 'single_short',
        createdAt: '2026-02-08T00:00:00Z'
      }
    ];

    const schedulingContext: SelectionSchedulingContext = {
      currentTimeJST: '2026-02-09 03:00:00 JST',
      videosCreatedToday: 4,
      totalDailyTarget: 12,
      formatsToday: {
        single_short: 2,
        multi_short: 1,
        long: 1
      },
      remainingTargets: {
        single_short: 2,
        multi_short: 3,
        long: 3
      }
    };

    const prompt = buildEnhancedSelectionPrompt(articles, pastVideos, schedulingContext);

    expect(prompt).toContain('PAST 36H VIDEO HISTORY:');
    expect(prompt).toContain('~4 long / ~4 single_short / ~4 multi_short');
    expect(prompt).toContain('For multi_short: select 2-6 related/complementary stories');
  });
});
