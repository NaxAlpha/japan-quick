/**
 * Gemini AI service for article selection
 */

import { GoogleGenAI } from '@google/genai';
import type { AISelectionOutput, VideoType, VideoScript } from '../types/video.js';
import type { Article } from '../types/article.js';
import { log } from '../lib/logger.js';
import { buildSelectionPrompt, buildScriptPrompt } from '../lib/prompts.js';

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
   * Call Gemini AI to select articles
   */
  async selectArticles(reqId: string, articles: Article[]): Promise<SelectionResult> {
    log.gemini.info(reqId, 'Article selection started', { articleCount: articles.length });
    const startTime = Date.now();

    try {
      // Format articles and create index mapping
      const { formatted, mapping } = this.formatArticlesForAI(articles);

      // Build prompt
      const prompt = buildSelectionPrompt(formatted);

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
      const prompt = buildScriptPrompt(input);

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
