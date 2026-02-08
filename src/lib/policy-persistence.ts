import type { PolicyCheckResult } from '../services/policy-checker.js';
import type { PolicyCheckStage, PolicyStageStatus } from '../types/video.js';
import {
  deriveOverallPolicyStatus,
  extractBlockReasons,
  normalizePolicyStageStatus
} from './policy.js';

const POLICY_COST_LOG_TYPE: Record<PolicyCheckStage, string> = {
  script_light: 'policy-script-light',
  asset_strong: 'policy-asset-strong'
};

const MODEL_PRICE_FALLBACK: Record<string, { input: number; output: number }> = {
  'gemini-3-flash-preview': { input: 0.5, output: 3.0 },
  'gemini-3-pro-preview': { input: 2.0, output: 12.0 }
};

interface VideoPolicySnapshot {
  script_policy_status: string | null;
  asset_policy_status: string | null;
  policy_block_reasons: string | null;
}

interface ModelPricingRow {
  input_cost_per_million: number;
  output_cost_per_million: number;
}

export interface PersistPolicyCheckParams {
  videoId: number;
  result: PolicyCheckResult;
}

export interface PersistPolicyCheckOutput {
  policyRunId: number;
  stageStatus: PolicyStageStatus;
  overallStatus: PolicyStageStatus;
  cost: number;
  blockReasons: string[];
}

function parseBlockReasons(rawReasons: string | null): string[] {
  if (!rawReasons) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawReasons) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  } catch {
    return [];
  }
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    deduped.push(value);
  }

  return deduped;
}

function calculateUsageCost(
  inputTokens: number,
  outputTokens: number,
  inputCostPerMillion: number,
  outputCostPerMillion: number
): number {
  const inputCost = (inputTokens / 1_000_000) * inputCostPerMillion;
  const outputCost = (outputTokens / 1_000_000) * outputCostPerMillion;
  return inputCost + outputCost;
}

async function resolveModelPricing(db: D1Database, modelId: string): Promise<ModelPricingRow> {
  const modelPricing = await db.prepare(`
    SELECT input_cost_per_million, output_cost_per_million
    FROM models
    WHERE id = ?
  `).bind(modelId).first<ModelPricingRow>();

  if (modelPricing) {
    return modelPricing;
  }

  const fallback = MODEL_PRICE_FALLBACK[modelId];
  if (fallback) {
    return {
      input_cost_per_million: fallback.input,
      output_cost_per_million: fallback.output
    };
  }

  return {
    input_cost_per_million: 0,
    output_cost_per_million: 0
  };
}

function buildPolicySummary(stage: PolicyCheckStage, summary: string): string {
  const stageLabel = stage === 'script_light' ? 'Script light check' : 'Asset strong check';
  return `${stageLabel}: ${summary}`;
}

export async function persistPolicyCheck(db: D1Database, params: PersistPolicyCheckParams): Promise<PersistPolicyCheckOutput> {
  const { videoId, result } = params;

  const pricing = await resolveModelPricing(db, result.modelId);
  const cost = calculateUsageCost(
    result.tokenUsage.inputTokens,
    result.tokenUsage.outputTokens,
    pricing.input_cost_per_million,
    pricing.output_cost_per_million
  );

  const runInsert = await db.prepare(`
    INSERT INTO policy_runs (
      video_id,
      stage,
      model_id,
      status,
      summary,
      prompt_r2_key,
      response_r2_key,
      input_tokens,
      output_tokens,
      cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).bind(
    videoId,
    result.stage,
    result.modelId,
    result.stageStatus,
    result.summary,
    result.promptR2Key,
    result.responseR2Key,
    result.tokenUsage.inputTokens,
    result.tokenUsage.outputTokens,
    cost
  ).first<{ id: number }>();

  if (!runInsert) {
    throw new Error('Failed to persist policy run');
  }

  for (const finding of result.findings) {
    await db.prepare(`
      INSERT INTO policy_findings (
        policy_run_id,
        check_code,
        check_label,
        status,
        reason,
        evidence_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      runInsert.id,
      finding.checkCode,
      finding.checkLabel,
      finding.status,
      finding.reason,
      JSON.stringify(finding.evidence)
    ).run();
  }

  await db.prepare(`
    INSERT INTO cost_logs (video_id, log_type, model_id, attempt_id, input_tokens, output_tokens, cost)
    VALUES (?, ?, ?, 1, ?, ?, ?)
  `).bind(
    videoId,
    POLICY_COST_LOG_TYPE[result.stage],
    result.modelId,
    result.tokenUsage.inputTokens,
    result.tokenUsage.outputTokens,
    cost
  ).run();

  const currentSnapshot = await db.prepare(`
    SELECT script_policy_status, asset_policy_status, policy_block_reasons
    FROM videos
    WHERE id = ?
  `).bind(videoId).first<VideoPolicySnapshot>();

  if (!currentSnapshot) {
    throw new Error(`Video ${videoId} not found when updating policy status`);
  }

  const scriptStatus = result.stage === 'script_light'
    ? result.stageStatus
    : normalizePolicyStageStatus(currentSnapshot.script_policy_status);

  const assetStatus = result.stage === 'asset_strong'
    ? result.stageStatus
    : normalizePolicyStageStatus(currentSnapshot.asset_policy_status);

  const overallStatus = deriveOverallPolicyStatus(scriptStatus, assetStatus);
  const existingBlockReasons = parseBlockReasons(currentSnapshot.policy_block_reasons);
  const stageBlockReasons = extractBlockReasons(result.findings.map((finding) => ({
    status: finding.status,
    checkCode: finding.checkCode,
    reason: finding.reason
  })));

  let mergedBlockReasons: string[] = [];
  if (overallStatus === 'BLOCK') {
    mergedBlockReasons = dedupeStrings([...existingBlockReasons, ...stageBlockReasons]);
    if (mergedBlockReasons.length === 0 && result.summary.trim().length > 0) {
      mergedBlockReasons = [result.summary.trim()];
    }
  }

  const summaryText = buildPolicySummary(result.stage, result.summary);

  if (result.stage === 'script_light') {
    await db.prepare(`
      UPDATE videos
      SET script_policy_status = ?,
          policy_overall_status = ?,
          policy_summary = ?,
          policy_block_reasons = ?,
          policy_last_checked_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      scriptStatus,
      overallStatus,
      summaryText,
      JSON.stringify(mergedBlockReasons),
      videoId
    ).run();
  } else {
    await db.prepare(`
      UPDATE videos
      SET asset_policy_status = ?,
          policy_overall_status = ?,
          policy_summary = ?,
          policy_block_reasons = ?,
          policy_last_checked_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      assetStatus,
      overallStatus,
      summaryText,
      JSON.stringify(mergedBlockReasons),
      videoId
    ).run();
  }

  const totalCostResult = await db.prepare(`
    SELECT COALESCE(SUM(cost), 0) AS total_cost
    FROM cost_logs
    WHERE video_id = ?
  `).bind(videoId).first<{ total_cost: number }>();

  await db.prepare(`
    UPDATE videos
    SET total_cost = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(totalCostResult?.total_cost || 0, videoId).run();

  return {
    policyRunId: runInsert.id,
    stageStatus: result.stageStatus,
    overallStatus,
    cost,
    blockReasons: mergedBlockReasons
  };
}
