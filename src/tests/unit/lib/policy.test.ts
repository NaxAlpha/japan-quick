import { describe, expect, it } from 'vitest';
import {
  maxFindingStatus,
  deriveStageStatusFromFindingStatus,
  deriveOverallPolicyStatus,
  getUploadPrivacyForPolicyStatus,
  normalizePolicyStageStatus,
  extractBlockReasons
} from '../../../lib/policy.js';

describe('policy helpers', () => {
  it('aggregates finding severities correctly', () => {
    expect(maxFindingStatus(['PASS', 'WARN'])).toBe('WARN');
    expect(maxFindingStatus(['PASS', 'REVIEW', 'WARN'])).toBe('REVIEW');
    expect(maxFindingStatus(['PASS', 'BLOCK'])).toBe('BLOCK');
  });

  it('maps finding severity to stage status', () => {
    expect(deriveStageStatusFromFindingStatus('PASS')).toBe('CLEAN');
    expect(deriveStageStatusFromFindingStatus('WARN')).toBe('WARN');
    expect(deriveStageStatusFromFindingStatus('REVIEW')).toBe('REVIEW');
    expect(deriveStageStatusFromFindingStatus('BLOCK')).toBe('BLOCK');
  });

  it('derives overall status using the highest stage severity', () => {
    expect(deriveOverallPolicyStatus('CLEAN', 'WARN')).toBe('WARN');
    expect(deriveOverallPolicyStatus('REVIEW', 'WARN')).toBe('REVIEW');
    expect(deriveOverallPolicyStatus('BLOCK', 'CLEAN')).toBe('BLOCK');
    expect(deriveOverallPolicyStatus('PENDING', 'REVIEW')).toBe('REVIEW');
  });

  it('maps upload privacy by policy status', () => {
    expect(getUploadPrivacyForPolicyStatus('CLEAN')).toBe('public');
    expect(getUploadPrivacyForPolicyStatus('WARN')).toBe('private');
    expect(getUploadPrivacyForPolicyStatus('REVIEW')).toBe('private');
    expect(getUploadPrivacyForPolicyStatus('PENDING')).toBe('private');
    expect(getUploadPrivacyForPolicyStatus('BLOCK')).toBeNull();
  });

  it('normalizes unknown policy status values safely', () => {
    expect(normalizePolicyStageStatus('clean')).toBe('CLEAN');
    expect(normalizePolicyStageStatus('review')).toBe('REVIEW');
    expect(normalizePolicyStageStatus('unknown')).toBe('PENDING');
    expect(normalizePolicyStageStatus(null)).toBe('PENDING');
  });

  it('extracts explicit block reasons from findings only', () => {
    const reasons = extractBlockReasons([
      { status: 'PASS', checkCode: 'A', reason: 'ok' },
      { status: 'BLOCK', checkCode: 'B', reason: 'serious issue' },
      { status: 'WARN', checkCode: 'C', reason: 'warning' }
    ]);

    expect(reasons).toEqual(['B: serious issue']);
  });
});
