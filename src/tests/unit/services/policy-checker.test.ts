import { describe, expect, it } from 'vitest';
import { safeParsePolicyResponse } from '../../../services/policy-checker.js';

describe('policy-checker response parsing', () => {
  it('parses strict JSON responses', () => {
    const parsed = safeParsePolicyResponse(`{
      "summary": "All good",
      "findings": [{"checkCode":"X","status":"PASS"}]
    }`);

    expect(parsed.summary).toBe('All good');
    expect(Array.isArray(parsed.findings)).toBe(true);
    expect((parsed.findings as Array<{ checkCode?: string }>)[0].checkCode).toBe('X');
  });

  it('parses JSON wrapped in markdown fences', () => {
    const parsed = safeParsePolicyResponse(`\`\`\`json
{
  "summary": "Fence output",
  "findings": []
}
\`\`\``);

    expect(parsed.summary).toBe('Fence output');
    expect(parsed.findings).toEqual([]);
  });

  it('returns safe fallback when response is not valid JSON', () => {
    const parsed = safeParsePolicyResponse('not json at all');

    expect(parsed.summary).toContain('could not be parsed');
    expect(parsed.findings).toEqual([]);
  });
});
