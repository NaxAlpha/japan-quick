import type { PolicyFindingStatus, PolicyStageStatus } from '../types/video.js';

const FINDING_SEVERITY: Record<PolicyFindingStatus, number> = {
  PASS: 0,
  WARN: 1,
  REVIEW: 2,
  BLOCK: 3
};

const STAGE_SEVERITY: Record<PolicyStageStatus, number> = {
  PENDING: -1,
  CLEAN: 0,
  WARN: 1,
  REVIEW: 2,
  BLOCK: 3
};

export function comparePolicyStageSeverity(a: PolicyStageStatus, b: PolicyStageStatus): number {
  return (STAGE_SEVERITY[a] ?? -1) - (STAGE_SEVERITY[b] ?? -1);
}

export function maxFindingStatus(statuses: PolicyFindingStatus[]): PolicyFindingStatus {
  if (statuses.length === 0) {
    return 'PASS';
  }

  let maxStatus: PolicyFindingStatus = 'PASS';
  for (const status of statuses) {
    if ((FINDING_SEVERITY[status] ?? 0) > (FINDING_SEVERITY[maxStatus] ?? 0)) {
      maxStatus = status;
    }
  }

  return maxStatus;
}

export function deriveStageStatusFromFindingStatus(status: PolicyFindingStatus): PolicyStageStatus {
  if (status === 'BLOCK') {
    return 'BLOCK';
  }
  if (status === 'REVIEW') {
    return 'REVIEW';
  }
  if (status === 'WARN') {
    return 'WARN';
  }
  return 'CLEAN';
}

export function deriveOverallPolicyStatus(scriptStatus: PolicyStageStatus, assetStatus: PolicyStageStatus): PolicyStageStatus {
  if (comparePolicyStageSeverity(scriptStatus, assetStatus) >= 0) {
    return scriptStatus;
  }
  return assetStatus;
}

export function getUploadPrivacyForPolicyStatus(status: PolicyStageStatus): 'public' | 'private' | null {
  if (status === 'BLOCK') {
    return null;
  }

  if (status === 'CLEAN') {
    return 'public';
  }

  // Pending and elevated statuses default to private for safety.
  return 'private';
}

export function normalizePolicyStageStatus(value: string | null | undefined): PolicyStageStatus {
  if (!value) {
    return 'PENDING';
  }

  const upper = value.trim().toUpperCase();
  if (upper === 'PENDING' || upper === 'CLEAN' || upper === 'WARN' || upper === 'REVIEW' || upper === 'BLOCK') {
    return upper;
  }

  return 'PENDING';
}

export function extractBlockReasons(findings: Array<{ status: PolicyFindingStatus; checkCode: string; reason: string }>): string[] {
  return findings
    .filter((finding) => finding.status === 'BLOCK')
    .map((finding) => `${finding.checkCode}: ${finding.reason}`);
}
