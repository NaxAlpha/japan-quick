/**
 * Gemini AI service for article selection
 */

import { GoogleGenAI } from '@google/genai';
import type { AIArticleInput, AISelectionOutput, VideoType, VideoScript } from '../types/video.js';
import type { Article } from '../types/article.js';
import { log } from '../lib/logger.js';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

interface SelectionResult {
  notes: string;           // Newline-joined rationale strings
  shortTitle: string;
  articles: string[];      // Array of pick_id values
  videoType: VideoType;
  tokenUsage: TokenUsage;
}

interface ArticleWithContent {
  pickId: string;
  title: string;
  content: string;
  contentText?: string;
  comments: Array<{
    author?: string;
    content: string;
    likes: number;
    replies?: Array<{
      author?: string;
      content: string;
    }>;
  }>;
  images: string[];
}

interface ScriptGenerationInput {
  videoType: VideoType;
  articles: ArticleWithContent[];
}

interface ScriptGenerationResult {
  script: VideoScript;
  tokenUsage: TokenUsage;
}


export class GeminiService {
  private genai: GoogleGenAI;

  constructor(apiKey: string) {
    this.genai = new GoogleGenAI({ apiKey });
  }

  /**
   * Create 4-digit indices from pick_id and track mapping
   */
  formatArticlesForAI(articles: Article[]): { formatted: AIArticleInput[]; mapping: Map<string, string> } {
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
   * Build AI selection prompt with article list and selection rules
   */
  buildSelectionPrompt(articles: AIArticleInput[]): string {
    const articleList = articles
      .map(a => `[${a.index}] ${a.title}\n${a.dateTime}, ${a.source}`)
      .join('\n\n');

    return `You are an AI video editor for "Japan Quick", selecting important Japanese news articles for video generation.

ARTICLES:
${articleList}

TASK:
Analyze these articles and select the MOST IMPORTANT article(s) for video generation. You must select ONE article for a single story, OR multiple related articles if they tell a bigger story together.

VIDEO TYPES:
- "short" (60-120s, 1080x1920 vertical): Breaking news, urgent updates, trending topics
  Examples: Earthquake warning, market movement, sudden policy announcement
- "long" (4-6 min, 1920x1080 horizontal): In-depth analysis, informative content, complex stories
  Examples: New technology explanation, historical analysis, detailed policy breakdown

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
  }

  /**
   * Call Gemini AI to select articles
   */
  async selectArticles(reqId: string, articles: Article[]): Promise<SelectionResult> {
    log.gemini.info(reqId, 'Article selection started', { articleCount: articles.length });
    const startTime = Date.now();

    try {
      // Format articles and create index mapping
      const { formatted, mapping } = this.formatArticlesForAI(articles);

      // Build prompt
      const prompt = this.buildSelectionPrompt(formatted);

      // Call Gemini API using the correct format
      const response = await this.genai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      // Extract token usage
      const usageMetadata = response.usageMetadata;
      const tokenUsage: TokenUsage = {
        inputTokens: usageMetadata?.promptTokenCount || 0,
        outputTokens: usageMetadata?.candidatesTokenCount || 0
      };

      const durationMs = Date.now() - startTime;
      log.gemini.info(reqId, 'Gemini API call completed', {
        durationMs,
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens
      });

      // Parse JSON response
      const text = response.text;
      if (!text) {
        throw new Error('No text in Gemini response');
      }
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const parsed: AISelectionOutput = JSON.parse(cleanText);

      // Map AI indices back to pick_ids
      const pickIds = parsed.articles.map(index => {
        const pickId = mapping.get(index);
        if (!pickId) {
          throw new Error(`Invalid article index from AI: ${index}`);
        }
        return pickId;
      });

      // Convert notes array to newline-joined string
      const notesString = parsed.notes.join('\n');

      const result = {
        notes: notesString,
        shortTitle: parsed.short_title,
        articles: pickIds,
        videoType: parsed.video_type,
        tokenUsage
      };

      log.gemini.info(reqId, 'Article selection completed', {
        selectedCount: result.articles.length,
        videoType: result.videoType
      });

      return result;
    } catch (error) {
      log.gemini.error(reqId, 'Article selection failed', error as Error);
      throw error;
    }
  }

  /**
   * Build AI script generation prompt with articles and generation rules
   */
  buildScriptPrompt(input: ScriptGenerationInput): string {
    const { videoType, articles } = input;
    const isShort = videoType === 'short';
    const aspectRatio = isShort ? '1080x1920 (vertical)' : '1920x1080 (horizontal)';
    const targetDuration = isShort ? '60-120 seconds' : '4-6 minutes';
    const slideCount = isShort ? '6-8 slides' : '15-17 slides';

    // Format articles for the prompt
    const articlesText = articles.map((article, idx) => {
      let text = `### Article ${idx + 1}: ${article.title}\n\n`;
      text += `Content:\n${article.contentText || article.content}\n\n`;

      if (article.images.length > 0) {
        text += `Reference Images:\n${article.images.join('\n')}\n\n`;
      }

      if (article.comments.length > 0) {
        const topComments = article.comments.slice(0, 10);
        text += `Top Comments:\n`;
        topComments.forEach(comment => {
          text += `- ${comment.content} (${comment.likes} likes)\n`;
          if (comment.replies && comment.replies.length > 0) {
            comment.replies.forEach(reply => {
              text += `  └ ${reply.content}\n`;
            });
          }
        });
        text += '\n';
      }

      return text;
    }).join('\n---\n\n');

    return `You are an AI video script writer for "Japan Quick", creating structured video scripts for Japanese news content.

VIDEO SPECS:
- Type: ${videoType}
- Duration: ${targetDuration}
- Aspect Ratio: ${aspectRatio}
- Slides: ${slideCount} (each slide 10-20 seconds)

ARTICLES:
${articlesText}

TASK:
Create a compelling video script that tells this story effectively. Follow these requirements:

1. SLIDE COUNT & DURATION:
   - Create ${slideCount} depending on article length
   - Each slide should be 10-20 seconds (estimate based on narration)
   - Distribute information smoothly across slides (no dumping everything at start or end)

2. NARRATION LANGUAGE:
   - Use the SAME language as the input articles for all text fields (title, description, narration)
   - Keep the natural flow and tone of the source language

3. IMAGE DESCRIPTIONS (ALWAYS IN ENGLISH):
   - Be very precise and detailed
   - Reference objects/subjects from the reference images provided
   - If famous person, name them directly: "Elon Musk speaking at a podium"
   - If generic person, prefer male unless story requires female
   - If a generic person remains part of the story, name them in starting images and reuse: "Ken, a middle-aged businessman"
   - Prefer angles not showing faces: from backs, from far, blurred in background
   - For women: full modest attire, no skin showing, prefer head covers or face masks, loose clothes, use culturally relevant items
   - Images must match story location (Japanese story = Japanese places/people/settings)
   - Consider aspect ratio ${aspectRatio}: place objects accordingly (vertical vs horizontal composition)

4. THUMBNAIL:
   - Create a compelling thumbnail matching story content
   - Include main characters if any (following same image description rules)
   - Include text overlay matching the video title
   - Make it attention-grabbing and clickable

RESPONSE FORMAT (JSON only):
{
  "title": "SEO-optimized YouTube title in article language",
  "description": "SEO-optimized description in article language",
  "thumbnailDescription": "Detailed thumbnail image prompt in English",
  "slides": [
    {
      "headline": "Short slide title",
      "imageDescription": "Detailed image prompt in English",
      "audioNarration": "Narration text in article language",
      "estimatedDuration": 15
    }
  ]
}

RULES:
- All text fields (title, description, audioNarration, headline) in article language
- All imageDescription fields in English
- Title should be compelling and SEO-friendly for YouTube
- Description should summarize the video and include keywords
- Each slide's audioNarration should match the estimatedDuration (10-20 seconds of speech)
- Ensure smooth information flow across all slides

Respond with ONLY the JSON object, no other text.`;
  }

  /**
   * Call Gemini AI to generate video script
   */
  async generateScript(reqId: string, input: ScriptGenerationInput): Promise<ScriptGenerationResult> {
    log.scriptGeneration.info(reqId, 'Script generation started', {
      videoType: input.videoType,
      articleCount: input.articles.length
    });
    const startTime = Date.now();

    try {
      // Build prompt
      const prompt = this.buildScriptPrompt(input);

      // Call Gemini API
      const response = await this.genai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      // Extract token usage
      const usageMetadata = response.usageMetadata;
      const tokenUsage: TokenUsage = {
        inputTokens: usageMetadata?.promptTokenCount || 0,
        outputTokens: usageMetadata?.candidatesTokenCount || 0
      };

      const durationMs = Date.now() - startTime;
      log.scriptGeneration.info(reqId, 'Gemini API call completed', {
        durationMs,
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens
      });

      // Parse JSON response
      const text = response.text;
      if (!text) {
        throw new Error('No text in Gemini response');
      }
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const script: VideoScript = JSON.parse(cleanText);

      log.scriptGeneration.info(reqId, 'Script generation completed', {
        slideCount: script.slides.length,
        titleLength: script.title.length
      });

      return { script, tokenUsage };
    } catch (error) {
      log.scriptGeneration.error(reqId, 'Script generation failed', error as Error);
      throw error;
    }
  }
}
