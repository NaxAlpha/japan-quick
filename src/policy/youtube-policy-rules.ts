export type PolicyCheckStage = 'script_light' | 'asset_strong';

export type PolicyFindingStatus = 'PASS' | 'WARN' | 'REVIEW' | 'BLOCK';

export type PolicyStageStatus = 'PENDING' | 'CLEAN' | 'WARN' | 'REVIEW' | 'BLOCK';

export interface PolicyCheckRule {
  code: string;
  label: string;
  stage: PolicyCheckStage;
  description: string;
  blockCriteria: string;
  reviewCriteria: string;
  warnCriteria: string;
}

const SCRIPT_LIGHT_RULES: PolicyCheckRule[] = [
  {
    code: 'MISINFO_SENSITIVE_CLAIMS',
    label: 'Sensitive misinformation claims',
    stage: 'script_light',
    description: 'Reject unsupported election, medical, and high-harm factual claims.',
    blockCriteria: 'Claim clearly violates election/medical misinformation policy or gives dangerous false guidance.',
    reviewCriteria: 'Sensitive claim lacks strong source grounding or certainty language is too strong.',
    warnCriteria: 'Needs softer uncertainty framing but does not assert prohibited falsehoods.'
  },
  {
    code: 'DECEPTIVE_METADATA_COPY',
    label: 'Deceptive title/description copy',
    stage: 'script_light',
    description: 'Detect text-level mismatch between claims and article evidence.',
    blockCriteria: 'Title/description materially fabricates facts or intent.',
    reviewCriteria: 'Strong exaggeration likely to mislead viewers.',
    warnCriteria: 'Minor clickbait phrasing that should be toned down.'
  },
  {
    code: 'HATE_HARASSMENT_TEXT',
    label: 'Hate or harassment language',
    stage: 'script_light',
    description: 'Disallow abuse targeting protected groups or individuals.',
    blockCriteria: 'Contains direct hate speech, dehumanization, or targeted harassment.',
    reviewCriteria: 'Ambiguous hostile framing around protected characteristics.',
    warnCriteria: 'Aggressive tone likely to trigger moderation concerns.'
  },
  {
    code: 'HARMFUL_DANGEROUS_TEXT',
    label: 'Harmful or dangerous language',
    stage: 'script_light',
    description: 'Disallow instructions or encouragement for dangerous acts.',
    blockCriteria: 'Includes harmful instructions, encouragement, or explicit self-harm normalization.',
    reviewCriteria: 'Potentially unsafe framing around dangerous topics.',
    warnCriteria: 'Needs safer wording and context disclaimers.'
  },
  {
    code: 'INAUTHENTIC_REPETITION_TEXT',
    label: 'Inauthentic repetitive structure',
    stage: 'script_light',
    description: 'Reduce repetitive/templated narrative patterns linked to inauthenticity risk.',
    blockCriteria: 'Extremely repetitive output with minimal original informational value.',
    reviewCriteria: 'High template reuse with low novelty.',
    warnCriteria: 'Moderate template reuse; improve originality.'
  }
];

const ASSET_STRONG_RULES: PolicyCheckRule[] = [
  {
    code: 'VISUAL_MISLEADING_THUMBNAIL',
    label: 'Misleading thumbnail/image claims',
    stage: 'asset_strong',
    description: 'Check thumbnail and visuals for deceptive mismatch against script/articles.',
    blockCriteria: 'Thumbnail or key image depicts fabricated core events/claims.',
    reviewCriteria: 'Visual implication materially overstates or distorts story facts.',
    warnCriteria: 'Minor sensational embellishment that should be reduced.'
  },
  {
    code: 'VISUAL_BRANDING_CTA',
    label: 'Branding/CTA artifacts in generated images',
    stage: 'asset_strong',
    description: 'Disallow subscribe buttons, social icons, or channel branding inside generated visuals.',
    blockCriteria: 'Deliberate deceptive overlays or strong manipulative UI mimicry.',
    reviewCriteria: 'Repeated branding/CTA artifacts across multiple assets.',
    warnCriteria: 'Single-instance branding/CTA artifact requiring regeneration.'
  },
  {
    code: 'VISUAL_HARMFUL_GRAPHIC',
    label: 'Graphic or harmful visuals',
    stage: 'asset_strong',
    description: 'Detect graphic violence, self-harm, or dangerous depictions.',
    blockCriteria: 'Graphic violence, explicit self-harm imagery, or dangerous instructional visuals.',
    reviewCriteria: 'Potentially distressing content requiring manual review.',
    warnCriteria: 'Intensity is high but not overtly graphic.'
  },
  {
    code: 'VISUAL_HATE_HARASSMENT',
    label: 'Hate or harassment visuals',
    stage: 'asset_strong',
    description: 'Disallow hateful symbols or abusive targeting visuals.',
    blockCriteria: 'Explicit hateful/harassing visual targeting.',
    reviewCriteria: 'Ambiguous but concerning hostile visual framing.',
    warnCriteria: 'Borderline aggressive cues requiring revision.'
  },
  {
    code: 'SYNTHETIC_CONTEXT_INTEGRITY',
    label: 'Synthetic media context integrity',
    stage: 'asset_strong',
    description: 'Ensure synthetic visuals are not presented as deceptive real footage context.',
    blockCriteria: 'Synthetic media is intentionally used to mislead about real events.',
    reviewCriteria: 'Context may mislead without stronger framing.',
    warnCriteria: 'Minor context clarity issues.'
  },
  {
    code: 'INAUTHENTIC_REPETITION_VISUAL',
    label: 'Inauthentic repetitive visuals',
    stage: 'asset_strong',
    description: 'Detect low-originality visual template reuse likely to hurt monetization quality signals.',
    blockCriteria: 'Near-duplicate visual set with negligible content differentiation.',
    reviewCriteria: 'High repetitive template use across the set.',
    warnCriteria: 'Moderate repetition requiring more variation.'
  }
];

export const POLICY_RULES: Record<PolicyCheckStage, PolicyCheckRule[]> = {
  script_light: SCRIPT_LIGHT_RULES,
  asset_strong: ASSET_STRONG_RULES
};

const FINDING_STATUS_SEVERITY: Record<PolicyFindingStatus, number> = {
  PASS: 0,
  WARN: 1,
  REVIEW: 2,
  BLOCK: 3
};

const STAGE_STATUS_SEVERITY: Record<PolicyStageStatus, number> = {
  PENDING: -1,
  CLEAN: 0,
  WARN: 1,
  REVIEW: 2,
  BLOCK: 3
};

export function getPolicyRulesForStage(stage: PolicyCheckStage): PolicyCheckRule[] {
  return POLICY_RULES[stage];
}

export function deriveStageStatusFromFindings(findings: PolicyFindingStatus[]): PolicyStageStatus {
  if (findings.length === 0) {
    return 'CLEAN';
  }

  let maxSeverity = 0;
  for (const status of findings) {
    const severity = FINDING_STATUS_SEVERITY[status] ?? 0;
    if (severity > maxSeverity) {
      maxSeverity = severity;
    }
  }

  if (maxSeverity >= FINDING_STATUS_SEVERITY.BLOCK) {
    return 'BLOCK';
  }
  if (maxSeverity >= FINDING_STATUS_SEVERITY.REVIEW) {
    return 'REVIEW';
  }
  if (maxSeverity >= FINDING_STATUS_SEVERITY.WARN) {
    return 'WARN';
  }
  return 'CLEAN';
}

export function deriveOverallPolicyStatus(stages: PolicyStageStatus[]): PolicyStageStatus {
  if (stages.length === 0) {
    return 'PENDING';
  }

  let maxSeverity = -1;
  for (const stage of stages) {
    const severity = STAGE_STATUS_SEVERITY[stage] ?? -1;
    if (severity > maxSeverity) {
      maxSeverity = severity;
    }
  }

  if (maxSeverity >= STAGE_STATUS_SEVERITY.BLOCK) {
    return 'BLOCK';
  }
  if (maxSeverity >= STAGE_STATUS_SEVERITY.REVIEW) {
    return 'REVIEW';
  }
  if (maxSeverity >= STAGE_STATUS_SEVERITY.WARN) {
    return 'WARN';
  }
  if (maxSeverity >= STAGE_STATUS_SEVERITY.CLEAN) {
    return 'CLEAN';
  }
  return 'PENDING';
}

export function formatPolicyRulesForPrompt(stage: PolicyCheckStage): string {
  const rules = POLICY_RULES[stage];

  const lines = rules.map((rule) => {
    return [
      `- ${rule.code} (${rule.label})`,
      `  - Description: ${rule.description}`,
      `  - BLOCK when: ${rule.blockCriteria}`,
      `  - REVIEW when: ${rule.reviewCriteria}`,
      `  - WARN when: ${rule.warnCriteria}`
    ].join('\n');
  });

  return lines.join('\n');
}

export function policyStageHasBlockingStatus(status: PolicyStageStatus): boolean {
  return status === 'BLOCK';
}
