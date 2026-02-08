import { describe, it, expect } from 'vitest';
import { evaluateVideoSelectionTrigger } from '../../../lib/video-selection-policy.js';

describe('video-selection-policy', () => {
  it('triggers for odd JST hour at minute 00', () => {
    const decision = evaluateVideoSelectionTrigger(new Date('2026-02-08T16:00:00.000Z')); // JST 01:00

    expect(decision.shouldTrigger).toBe(true);
    expect(decision.jstHour).toBe(1);
    expect(decision.jstMinute).toBe(0);
    expect(decision.isOddJstHour).toBe(true);
    expect(decision.isHourMark).toBe(true);
  });

  it('does not trigger for even JST hour at minute 00', () => {
    const decision = evaluateVideoSelectionTrigger(new Date('2026-02-08T17:00:00.000Z')); // JST 02:00

    expect(decision.shouldTrigger).toBe(false);
    expect(decision.jstHour).toBe(2);
    expect(decision.jstMinute).toBe(0);
    expect(decision.isOddJstHour).toBe(false);
    expect(decision.isHourMark).toBe(true);
  });

  it('does not trigger when minute is not 00', () => {
    const decision = evaluateVideoSelectionTrigger(new Date('2026-02-08T16:30:00.000Z')); // JST 01:30

    expect(decision.shouldTrigger).toBe(false);
    expect(decision.jstHour).toBe(1);
    expect(decision.jstMinute).toBe(30);
    expect(decision.isOddJstHour).toBe(true);
    expect(decision.isHourMark).toBe(false);
  });
});
