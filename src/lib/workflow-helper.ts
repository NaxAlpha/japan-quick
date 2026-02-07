/**
 * Workflow Helper - Provides utilities for common workflow patterns
 * Common patterns:
 * - AI selection with index mapping
 * - Token logging and cost calculation
 * - Result parsing and validation
 */

export interface AIArticleInput {
  index: string;
  title: string;
  dateTime: string;
  source: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface TokenUsageInfo {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  slideIndex?: number;  // Optional: for audio generation cost tracking
}

export interface AIResultMapping {
  mapping: Map<string, string>;
  formatted: AIArticleInput[];
}

export interface CostData {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  modelId: string;
}

/**
 * Create 4-digit indices from pick_id and track mapping
 * This pattern is used in gemini.ts to handle article selection
 * @param articles Array of articles to format
 * @returns Formatted articles with index mapping
 */
export function formatArticlesForAI(articles: any[]): AIResultMapping {
  const mapping = new Map<string, string>();
  const usedIndices = new Set<string>();

  const formatted = articles.map(article => {
    // Extract first 4 digits of pick_id, use last 4 if duplicate
    let index = article.pickId.substring(0, 4);
    if (usedIndices.has(index)) {
      index = article.pickId.substring(article.pickId.length - 4);
    }

    // Ensure uniqueness
    let counter = 1;
    let finalIndex = index;
    while (usedIndices.has(finalIndex)) {
      finalIndex = `${index.substring(0, 3)}${counter}`;
      counter++;
    }

    usedIndices.add(finalIndex);
    mapping.set(finalIndex, article.pickId);

    return {
      index: finalIndex,
      title: article.title || 'No title',
      dateTime: article.publishedAt || 'Unknown date',
      source: article.source || 'Unknown source'
    };
  });

  return { formatted, mapping };
}

/**
 * Map AI indices back to original pick_ids
 * @param aiIndices Array of indices returned by AI
 * @param mapping Index to pick_id mapping
 * @returns Array of original pick_ids
 */
export function mapIndicesToPickIds(aiIndices: string[], mapping: Map<string, string>): string[] {
  const pickIds = aiIndices.map(index => {
    const pickId = mapping.get(index);
    if (!pickId) {
      throw new Error(`Invalid article index from AI: ${index}`);
    }
    return pickId;
  });

  return pickIds;
}

/**
 * Calculate cost based on token usage
 * This pattern is used in video-selection.workflow.ts
 * @param inputTokens Number of input tokens
 * @param outputTokens Number of output tokens
 * @param modelId Optional model ID (default: 'gemini-3-flash-preview')
 * @returns Cost calculation result
 */
export function calculateTokenCost(
  inputTokens: number,
  outputTokens: number,
  modelId: string = 'gemini-3-flash-preview'
): CostData {
  // Gemini 3 Flash pricing: $0.50 per 1M input tokens, $3.00 per 1M output tokens
  const inputCost = (inputTokens / 1_000_000) * 0.50;
  const outputCost = (outputTokens / 1_000_000) * 3.00;
  const totalCost = inputCost + outputCost;

  return { inputCost, outputCost, totalCost, modelId };
}

/**
 * Parse AI JSON response and clean it
 * Common pattern used in gemini.ts for both selection and script generation
 * @param text Raw text response from AI
 * @param expectedType Expected response type (for logging)
 * @returns Parsed JSON object
 */
export function parseAIResponse(text: string, expectedType: string): any {
  if (!text) {
    throw new Error(`No text in ${expectedType} response`);
  }

  // Clean markdown formatting
  const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleanText);
  } catch (error) {
    throw new Error(`Failed to parse ${expectedType} JSON: ${cleanText}`);
  }
}

/**
 * Log token usage and cost to database
 * This pattern is used in video-selection.workflow.ts
 * @param db Database connection
 * @param videoId Video ID for cost logging
 * @param tokenUsage Token usage data
 * @param modelId Model ID used
 * @param logType Type of log (e.g., 'video-selection', 'script-generation')
 * @param attemptId Attempt ID (default: 1)
 * @returns Cost data for logging
 */
export async function logTokenUsage(
  db: D1Database,
  videoId: number,
  tokenUsage: TokenUsage,
  modelId: string = 'gemini-3-flash-preview',
  logType: string = 'video-selection',
  attemptId: number = 1
): Promise<CostData> {
  const costData = calculateTokenCost(tokenUsage.inputTokens, tokenUsage.outputTokens, modelId);

  await db.prepare(`
    INSERT INTO cost_logs (video_id, log_type, model_id, attempt_id, input_tokens, output_tokens, cost)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(videoId, logType, modelId, attemptId, tokenUsage.inputTokens, tokenUsage.outputTokens, costData.totalCost).run();

  return costData;
}

/**
 * Build AI prompt with article list
 * This pattern is used in gemini.ts for building selection prompts
 * @param articles Formatted articles array
 * @param promptTemplate Template for the prompt (optional)
 * @returns Complete prompt string
 */
export function buildAISelectionPrompt(
  articles: AIArticleInput[],
  promptTemplate?: string
): string {
  const articleList = articles
    .map(a => `[${a.index}] ${a.title}\n${a.dateTime}, ${a.source}`)
    .join('\n\n');

  const template = promptTemplate || `You are an AI video editor for "Japan Quick", selecting important Japanese news articles for video generation.

ARTICLES:
${articleList}

TASK:
Analyze these articles and select the MOST IMPORTANT article(s) for video generation. You must select ONE article for a single story, OR multiple related articles if they tell a bigger story together.

VIDEO TYPES:
- "short" (60-120s, 1080x1920 vertical): Breaking news, urgent updates, trending topics
- "long" (4-6 min, 1920x1080 horizontal): In-depth analysis, informative content, complex stories

PREFERENCES:
- PREFER: Useful, helpful, educational, story-like content

EXCLUSIONS:
- EXCLUDE: Celebrity gossip, death-related incidents, personal life of famous people

SELECTION CRITERIA:
1. IMPORTANCE: Impact on society, public interest, significance
2. TIMELINESS: Breaking news, trending topics, time-sensitive updates
3. CLARITY: Story is clear and can be explained effectively
4. ENGAGEMENT: Likely to capture viewer attention

RESPONSE FORMAT (JSON only):
{
  "notes": ["reason 1", "reason 2", "reason 3"],
  "short_title": "English title for the video (max 50 chars)",
  "articles": ["XXXX", "YYYY"],
  "video_type": "short" | "long"
}

RULES:
- Use the 4-digit indices (e.g., ["1234", "5678"]) in the "articles" field
- Provide 2-5 clear, concise reasons in the "notes" array
- short_title must be in English and under 50 characters
- Select "short" for urgent/trending, "long" for in-depth/analysis
- You MUST select at least one article from the list

Respond with ONLY the JSON object, no other text.`;

  return template;
}

/**
 * Validate AI response structure
 * @param response Parsed AI response
 * @param requiredFields Array of required fields to check
 * @returns Whether response is valid
 */
export function validateAIResponse(response: any, requiredFields: string[] = ['notes', 'short_title', 'articles', 'video_type']): boolean {
  if (!response || typeof response !== 'object') {
    return false;
  }

  for (const field of requiredFields) {
    if (!(field in response)) {
      return false;
    }
  }

  // Validate articles array contains only strings
  if (Array.isArray(response.articles)) {
    for (const item of response.articles) {
      if (typeof item !== 'string') {
        return false;
      }
    }
  } else {
    return false;
  }

  return true;
}
