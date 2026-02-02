/**
 * Prompts Module - Centralized AI prompt templates
 * Provides consistent, maintainable prompt strings for AI operations
 */

import type { AIArticleInputWithContent, PastVideoContext } from '../types/video.js';

export interface AIArticleInput {
  index: string;
  title: string;
  dateTime: string;
  source: string;
}

export interface ScriptGenerationInput {
  videoType: 'short' | 'long';
  articles: Array<{
    title: string;
    content: string;
    contentText?: string;
    images: string[];
    comments: Array<{
      content: string;
      likes: number;
      replies?: Array<{ content: string }>;
    }>;
  }>;
}

/**
 * Build article selection prompt
 * @param articles Formatted articles array
 * @returns Complete prompt string for article selection
 */
export function buildSelectionPrompt(articles: AIArticleInput[]): string {
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
 * Build enhanced article selection prompt with scheduling context
 * @param articles Formatted articles array with content
 * @param pastVideos Past 24h video history
 * @param schedulingContext Scheduling information
 * @returns Complete prompt string for enhanced article selection
 */
export function buildEnhancedSelectionPrompt(
  articles: AIArticleInputWithContent[],
  pastVideos: PastVideoContext[],
  schedulingContext: {
    currentTimeJST: string;
    videosCreatedToday: number;
    totalDailyTarget: number;
  }
): string {
  const { currentTimeJST, videosCreatedToday, totalDailyTarget } = schedulingContext;
  const videosRemaining = totalDailyTarget - videosCreatedToday;

  // Format past videos section
  const pastVideosText = pastVideos.length > 0
    ? pastVideos.map(v => `- [${v.videoFormat}] ${v.title} (${v.articles.join(', ')})`).join('\n')
    : 'None';

  // Format articles with content preview and status indicators
  const articleList = articles.map(a => {
    // Strip HTML tags and clean up the content
    const strippedContent = a.content
      .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
      .replace(/\s+/g, ' ')       // Normalize whitespace
      .trim();
    const contentPreview = strippedContent.substring(0, 800);
    const isShort = a.contentLength < 500;
    const statusIndicator = a.status === 'scraped_v1' ? '[V1]' : '[V2]';
    const shortMarker = isShort ? '[SHORT ARTICLE] ' : '';

    return `[${a.index}] ${statusIndicator} ${shortMarker}${a.title}
${a.dateTime}, ${a.source}
Content (${a.contentLength} chars): ${contentPreview}${strippedContent.length > 800 ? '...' : ''}`;
  }).join('\n\n---\n\n');

  return `You are an AI video editor for "Japan Quick", selecting important Japanese news articles for video generation.

CONTEXT:
- Current Time (JST): ${currentTimeJST}
- Videos Created Today: ${videosCreatedToday}/${totalDailyTarget}
- Videos Remaining: ${videosRemaining}
- NOTE: You are selecting content for IMMEDIATE upload, not future scheduling

PAST 24H VIDEO HISTORY:
${pastVideosText}

ARTICLES:
${articleList}

TASK:
Analyze these articles and select the MOST IMPORTANT article(s) for video generation. Consider scheduling context and avoid duplicating recent topics.

VIDEO FORMAT OPTIONS:
- "single_short" (60-90s, 1080x1920 vertical): Single breaking news story, urgent update, trending topic
  Examples: Earthquake warning, market crash, policy announcement
- "multi_short" (90-120s, 1080x1920 vertical): 2-3 related short stories combined
  Examples: Multiple tech updates, related policy changes, trending topic roundup
- "long" (4-6 min, 1920x1080 horizontal): In-depth analysis, complex story, detailed explanation
  Examples: Technology breakdown, historical context, policy analysis

URGENCY GUIDANCE:
- "urgent": Breaking news requiring immediate coverage (earthquakes, major incidents, market crashes)
- "developing": Trending topics, time-sensitive updates, evolving stories
- "regular": Informative content, analysis, educational material

TIMING CONTEXT (for content selection, NOT scheduling):
Consider what content is appropriate for the current time slot when selecting:
- 6-9 AM JST: Breaking overnight news, morning market updates, commuter-friendly shorts
- 9 AM-12 PM JST: Business news, policy updates, educational content
- 12-2 PM JST: Lunch-hour trending topics, lighter content, entertainment
- 2-6 PM JST: Afternoon analysis, developing stories, in-depth content
- 6-9 PM JST: Evening roundup, day's highlights, engaging stories
- 9 PM-12 AM JST: Late news, international coverage, relaxed content

CONTENT QUALITY NOTES:
- [V1] articles: Basic scraping, may have incomplete content
- [V2] articles: Enhanced scraping with better content extraction
- [SHORT ARTICLE]: Less than 500 chars, may need multiple articles for good video

PREFERENCES:
- PREFER: Useful, helpful, educational, story-like content
- PREFER: Combining multiple short articles into multi_short format
- PREFER: V2 articles over V1 when quality matters

EXCLUSIONS:
- EXCLUDE: Celebrity gossip, death-related incidents, personal life of famous people
- EXCLUDE: Topics covered in past 24h videos (check history above)

SELECTION CRITERIA:
1. IMPORTANCE: Impact on society, public interest, significance
2. TIMELINESS: Breaking news, trending topics, time-sensitive updates
3. CLARITY: Story is clear and can be explained effectively
4. ENGAGEMENT: Likely to capture viewer attention
5. NOVELTY: Not recently covered (check past 24h history)
6. APPROPRIATENESS: Content suitable for current time slot (will be uploaded immediately)

RESPONSE FORMAT (JSON only):
{
  "notes": ["reason 1", "reason 2", "reason 3"],
  "short_title": "English title for the video (max 50 chars)",
  "articles": ["XXXX", "YYYY"],
  "video_format": "single_short" | "multi_short" | "long",
  "urgency": "urgent" | "developing" | "regular",
  "skip_for_multi_story": ["XXXX"] (optional, for multi_short: articles to skip certain stories from)
}

RULES:
- Use the 4-digit indices (e.g., ["1234", "5678"]) in the "articles" field
- Provide 2-5 clear, concise reasons in the "notes" array
- short_title must be in English and under 50 characters
- For single_short: select 1 article only
- For multi_short: select 2-3 related articles
- For long: select 1-2 articles with substantial content
- Set urgency based on story nature and timing needs
- Select content appropriate for the current time slot (video will be uploaded immediately)
- Check past 24h history to avoid repetition
- You MUST select at least one article from the list

Respond with ONLY the JSON object, no other text.`;
}

/**
 * Build script generation prompt
 * @param input Script generation input with video type and articles
 * @returns Complete prompt string for script generation
 */
export function buildScriptPrompt(input: ScriptGenerationInput): string {
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
 * Build grid image generation prompt
 * @param options Grid image prompt options
 * @returns Complete prompt string for grid image generation
 */
export function buildGridImagePrompt(options: {
  isShort: boolean;
  gridSize: string;
  cellSize: string;
  cellDescriptions: string;
  thumbnailSection: string;
  emptySection: string;
}): string {
  const { isShort, gridSize, cellSize, cellDescriptions, thumbnailSection, emptySection } = options;

  return `
TASK: Generate a single ${gridSize} pixel image containing a 3x3 grid of ${isShort ? 'vertical (portrait)' : 'horizontal (landscape)'} images.

GRID LAYOUT:
- The output is ONE image divided into a 3x3 grid
- Each cell is ${cellSize} pixels
- Cells are numbered left-to-right, top-to-bottom: positions 0-8
- Grid lines, borders, gaps, or spaces MUST NOT be visible - images must tile seamlessly with ZERO pixels between cells

STYLE REQUIREMENTS:
- Consistent visual style across ALL cells
- ${isShort ? 'Dramatic, attention-grabbing visuals suitable for social media shorts' : 'Professional, cinematic quality suitable for YouTube videos'}
- High contrast, vibrant colors
- Clear focal points in each cell
- Modern, polished aesthetic

CRITICAL: No borders, gaps, or spaces between grid cells - cells must merge perfectly with zero separation

CELL CONTENTS:
${cellDescriptions}${thumbnailSection}${emptySection}

CRITICAL: Generate exactly ONE image with all cells combined. Do NOT generate separate images.
`.trim();
}
