import { GoogleGenAI } from '@google/genai';
import { ulid } from 'ulid';
import type { VideoScript, PolicyCheckStage, PolicyFindingStatus, PolicyStageStatus } from '../types/video.js';
import { log } from '../lib/logger.js';
import { R2StorageService } from './r2-storage.js';
import {
  deriveStageStatusFromFindings,
  formatPolicyRulesForPrompt,
  getPolicyRulesForStage,
  type PolicyCheckRule
} from '../policy/youtube-policy-rules.js';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface PolicyCheckArticleInput {
  pickId?: string;
  title: string;
  content: string;
  contentText?: string;
}

export interface PolicyAssetImageInput {
  label: string;
  mimeType: string;
  base64Data: string;
}

export interface PolicyCheckInput {
  videoId: number;
  articles: PolicyCheckArticleInput[];
  script: VideoScript;
}

export interface PolicyAssetCheckInput extends PolicyCheckInput {
  images: PolicyAssetImageInput[];
}

export interface PolicyCheckFindingResult {
  checkCode: string;
  checkLabel: string;
  status: PolicyFindingStatus;
  reason: string;
  evidence: string[];
}

export interface PolicyCheckResult {
  stage: PolicyCheckStage;
  modelId: string;
  stageStatus: PolicyStageStatus;
  summary: string;
  findings: PolicyCheckFindingResult[];
  tokenUsage: TokenUsage;
  promptText: string;
  responseText: string;
  promptR2Key: string;
  responseR2Key: string;
}

interface ParsedModelFinding {
  checkCode?: unknown;
  checkLabel?: unknown;
  status?: unknown;
  reason?: unknown;
  evidence?: unknown;
}

interface ParsedModelResponse {
  summary?: unknown;
  findings?: unknown;
}

const SCRIPT_LIGHT_MODEL = 'gemini-3-flash-preview';
const ASSET_STRONG_MODEL = 'gemini-3-pro-preview';
const MAX_ARTICLE_CHARS = 6000;
const MAX_IMAGE_PARTS = 24;

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n...[truncated]`;
}

function extractTokenUsage(response: unknown): TokenUsage {
  const usageMetadata = (response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }).usageMetadata;
  return {
    inputTokens: usageMetadata?.promptTokenCount || 0,
    outputTokens: usageMetadata?.candidatesTokenCount || 0
  };
}

function normalizeFindingStatus(rawStatus: unknown): PolicyFindingStatus {
  if (typeof rawStatus !== 'string') {
    return 'PASS';
  }

  const upper = rawStatus.trim().toUpperCase();
  if (upper === 'PASS' || upper === 'WARN' || upper === 'REVIEW' || upper === 'BLOCK') {
    return upper;
  }

  return 'PASS';
}

function normalizeEvidence(rawEvidence: unknown): string[] {
  if (!Array.isArray(rawEvidence)) {
    return [];
  }

  return rawEvidence
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
    .slice(0, 10);
}

function buildArticleText(articles: PolicyCheckArticleInput[]): string {
  return articles
    .map((article, index) => {
      const content = article.contentText || article.content;
      return [
        `Article ${index + 1}`,
        `- pickId: ${article.pickId || 'n/a'}`,
        `- title: ${article.title}`,
        `- content:\n${truncateText(content, MAX_ARTICLE_CHARS)}`
      ].join('\n');
    })
    .join('\n\n---\n\n');
}

function buildScriptText(script: VideoScript): string {
  return JSON.stringify(script, null, 2);
}

function buildPolicyPrompt(stage: PolicyCheckStage, input: PolicyCheckInput): string {
  const stageLabel = stage === 'script_light' ? 'SCRIPT LIGHT CHECK' : 'ASSET STRONG CHECK';
  const rules = formatPolicyRulesForPrompt(stage);

  return [
    `You are a YouTube policy auditor for generated news videos.`,
    ``,
    `STAGE: ${stageLabel}`,
    `VIDEO ID: ${input.videoId}`,
    ``,
    `TASK: Evaluate policy risk from the provided content and produce strict JSON output.`,
    ``,
    `SCORING INSTRUCTIONS:`,
    `- Evaluate every rule in the ruleset below.`,
    `- For each rule, return one status: PASS | WARN | REVIEW | BLOCK.`,
    `- Use BLOCK only for clear severe risk.`,
    `- Use REVIEW for medium risk or uncertainty that needs human check.`,
    `- Use WARN for low-risk issues that should be fixed.`,
    `- Use PASS when no issue is found for that rule.`,
    ``,
    `RULESET:`,
    rules,
    ``,
    `INPUT ARTICLES:`,
    buildArticleText(input.articles),
    ``,
    `INPUT SCRIPT JSON:`,
    buildScriptText(input.script),
    ``,
    `RESPONSE FORMAT (JSON ONLY):`,
    `{`,
    `  "summary": "Concise audit summary",`,
    `  "findings": [`,
    `    {`,
    `      "checkCode": "RULE_CODE",`,
    `      "checkLabel": "Rule label",`,
    `      "status": "PASS|WARN|REVIEW|BLOCK",`,
    `      "reason": "Why this status was chosen",`,
    `      "evidence": ["short evidence item"]`,
    `    }`,
    `  ]`,
    `}`,
    ``,
    `Do not include markdown fences or extra text.`
  ].join('\n');
}

function buildStrongAssetPrompt(input: PolicyAssetCheckInput): string {
  const basePrompt = buildPolicyPrompt('asset_strong', input);

  return [
    basePrompt,
    ``,
    `ADDITIONAL ASSET REVIEW REQUIREMENTS:`,
    `- You will receive generated image files as input parts before this text.`,
    `- Audit the images for misleading framing, harmful/graphic risks, hate/harassment cues, and branding/CTA artifacts.`,
    `- When evidence comes from an image, include the image label (e.g., "slide-03" or "thumbnail") in evidence.`
  ].join('\n');
}

function normalizeModelFindings(
  parsedResponse: ParsedModelResponse,
  rules: PolicyCheckRule[]
): PolicyCheckFindingResult[] {
  const ruleByCode = new Map(rules.map((rule) => [rule.code, rule]));

  const rawFindings = Array.isArray(parsedResponse.findings)
    ? parsedResponse.findings as ParsedModelFinding[]
    : [];

  const normalized: PolicyCheckFindingResult[] = [];
  const seenCodes = new Set<string>();

  for (const finding of rawFindings) {
    const checkCode = typeof finding.checkCode === 'string' ? finding.checkCode.trim() : '';
    if (!checkCode || !ruleByCode.has(checkCode)) {
      continue;
    }

    if (seenCodes.has(checkCode)) {
      continue;
    }

    const rule = ruleByCode.get(checkCode)!;
    const status = normalizeFindingStatus(finding.status);
    const reason = typeof finding.reason === 'string' && finding.reason.trim().length > 0
      ? finding.reason.trim()
      : 'No reason provided by policy model.';

    const checkLabel = typeof finding.checkLabel === 'string' && finding.checkLabel.trim().length > 0
      ? finding.checkLabel.trim()
      : rule.label;

    normalized.push({
      checkCode,
      checkLabel,
      status,
      reason,
      evidence: normalizeEvidence(finding.evidence)
    });

    seenCodes.add(checkCode);
  }

  for (const rule of rules) {
    if (seenCodes.has(rule.code)) {
      continue;
    }

    normalized.push({
      checkCode: rule.code,
      checkLabel: rule.label,
      status: 'PASS',
      reason: 'Model did not report an issue for this rule.',
      evidence: []
    });
  }

  return normalized;
}

export function safeParsePolicyResponse(responseText: string): ParsedModelResponse {
  try {
    const cleanText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanText) as ParsedModelResponse;
  } catch {
    return {
      summary: 'Policy model response could not be parsed. Marked for review.',
      findings: []
    };
  }
}

export class PolicyCheckerService {
  private genai: GoogleGenAI;
  private r2: R2StorageService;

  constructor(apiKey: string, bucket: R2Bucket, assetsPublicUrl: string) {
    this.genai = new GoogleGenAI({ apiKey });
    this.r2 = new R2StorageService(bucket, assetsPublicUrl);
  }

  private async uploadTextAsset(content: string): Promise<string> {
    const assetUlid = ulid();
    const bytes = new TextEncoder().encode(content);
    const result = await this.r2.uploadAsset(assetUlid, bytes.buffer as ArrayBuffer, 'text/plain; charset=utf-8');
    return result.key;
  }

  async runScriptLightCheck(reqId: string, input: PolicyCheckInput): Promise<PolicyCheckResult> {
    const startTime = Date.now();
    log.policy.info(reqId, 'Running script light policy check', { videoId: input.videoId, stage: 'script_light' });

    const modelId = SCRIPT_LIGHT_MODEL;
    const promptText = buildPolicyPrompt('script_light', input);

    const response = await this.genai.models.generateContent({
      model: modelId,
      contents: promptText
    });

    const tokenUsage = extractTokenUsage(response);
    const responseText = response.text || '';

    const parsedResponse = safeParsePolicyResponse(responseText);
    const rules = getPolicyRulesForStage('script_light');
    const findings = normalizeModelFindings(parsedResponse, rules);

    const hasNoFindingsFromModel = Array.isArray(parsedResponse.findings) && parsedResponse.findings.length === 0;
    if (hasNoFindingsFromModel && responseText.trim().length === 0) {
      findings.push({
        checkCode: 'MODEL_RESPONSE_EMPTY',
        checkLabel: 'Policy model response validity',
        status: 'REVIEW',
        reason: 'Policy model returned no usable response.',
        evidence: []
      });
    }

    const stageStatus = deriveStageStatusFromFindings(findings.map((finding) => finding.status));
    const summary = typeof parsedResponse.summary === 'string' && parsedResponse.summary.trim().length > 0
      ? parsedResponse.summary.trim()
      : 'Script light policy check completed.';

    const promptR2Key = await this.uploadTextAsset(promptText);
    const responseR2Key = await this.uploadTextAsset(responseText || '{}');

    log.policy.info(reqId, 'Script light policy check completed', {
      videoId: input.videoId,
      stageStatus,
      findingCount: findings.length,
      durationMs: Date.now() - startTime,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens
    });

    return {
      stage: 'script_light',
      modelId,
      stageStatus,
      summary,
      findings,
      tokenUsage,
      promptText,
      responseText,
      promptR2Key,
      responseR2Key
    };
  }

  async runAssetStrongCheck(reqId: string, input: PolicyAssetCheckInput): Promise<PolicyCheckResult> {
    const startTime = Date.now();
    log.policy.info(reqId, 'Running asset strong policy check', {
      videoId: input.videoId,
      stage: 'asset_strong',
      imageCount: input.images.length
    });

    const modelId = ASSET_STRONG_MODEL;
    const promptText = buildStrongAssetPrompt(input);

    const imageParts = input.images.slice(0, MAX_IMAGE_PARTS).map((image) => ({
      inlineData: {
        mimeType: image.mimeType,
        data: image.base64Data
      }
    }));

    const imageLabelsText = input.images
      .slice(0, MAX_IMAGE_PARTS)
      .map((image, index) => `- image-${index + 1}: ${image.label}`)
      .join('\n');

    const contents: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [
      ...imageParts,
      {
        text: `${promptText}\n\nIMAGE LABELS:\n${imageLabelsText || '- none'}`
      }
    ];

    const response = await this.genai.models.generateContent({
      model: modelId,
      contents
    });

    const tokenUsage = extractTokenUsage(response);
    const responseText = response.text || '';

    const parsedResponse = safeParsePolicyResponse(responseText);
    const rules = getPolicyRulesForStage('asset_strong');
    const findings = normalizeModelFindings(parsedResponse, rules);

    if (input.images.length > MAX_IMAGE_PARTS) {
      findings.push({
        checkCode: 'IMAGE_INPUT_TRUNCATED',
        checkLabel: 'Asset policy image coverage',
        status: 'REVIEW',
        reason: `Only ${MAX_IMAGE_PARTS} images were evaluated out of ${input.images.length}.`,
        evidence: [
          `evaluated_count=${MAX_IMAGE_PARTS}`,
          `total_count=${input.images.length}`
        ]
      });
    }

    const hasNoFindingsFromModel = Array.isArray(parsedResponse.findings) && parsedResponse.findings.length === 0;
    if (hasNoFindingsFromModel && responseText.trim().length === 0) {
      findings.push({
        checkCode: 'MODEL_RESPONSE_EMPTY',
        checkLabel: 'Policy model response validity',
        status: 'REVIEW',
        reason: 'Policy model returned no usable response.',
        evidence: []
      });
    }

    const stageStatus = deriveStageStatusFromFindings(findings.map((finding) => finding.status));
    const summary = typeof parsedResponse.summary === 'string' && parsedResponse.summary.trim().length > 0
      ? parsedResponse.summary.trim()
      : 'Asset strong policy check completed.';

    const promptR2Key = await this.uploadTextAsset(promptText);
    const responseR2Key = await this.uploadTextAsset(responseText || '{}');

    log.policy.info(reqId, 'Asset strong policy check completed', {
      videoId: input.videoId,
      stageStatus,
      findingCount: findings.length,
      durationMs: Date.now() - startTime,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens
    });

    return {
      stage: 'asset_strong',
      modelId,
      stageStatus,
      summary,
      findings,
      tokenUsage,
      promptText,
      responseText,
      promptR2Key,
      responseR2Key
    };
  }
}
