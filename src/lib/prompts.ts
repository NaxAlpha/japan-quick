/**
 * Prompts Module - Centralized AI prompt templates
 * Provides consistent, maintainable prompt strings for AI operations
 */

import type { AIArticleInputWithContent, PastVideoContext, VideoFormat, UrgencyLevel, AIArticleForScript, SelectionSchedulingContext } from '../types/video.js';

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
 * @param pastVideos Past 36h video history
 * @param schedulingContext Scheduling information
 * @returns Complete prompt string for enhanced article selection
 */
export function buildEnhancedSelectionPrompt(
  articles: AIArticleInputWithContent[],
  pastVideos: PastVideoContext[],
  schedulingContext: SelectionSchedulingContext
): string {
  const { currentTimeJST, videosCreatedToday, totalDailyTarget, formatsToday, remainingTargets } = schedulingContext;
  const videosRemaining = Math.max(0, totalDailyTarget - videosCreatedToday);

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

FORMAT MIX TODAY:
- Long Videos: ${formatsToday.long}/4 created, ${remainingTargets.long} remaining
- Single Shorts: ${formatsToday.single_short}/4 created, ${remainingTargets.single_short} remaining
- Multi Shorts: ${formatsToday.multi_short}/4 created, ${remainingTargets.multi_short} remaining

PRIORITY (use this to decide video_format):
1. Keep a balanced soft mix around ~4 long / ~4 single_short / ~4 multi_short across 24h
2. Avoid front-loading long videos in early-day slots unless the story is exceptionally strong
3. If one format is under target and suitable stories exist, prioritize that format
4. Otherwise choose the most valuable format for current news context

PAST 36H VIDEO HISTORY:
${pastVideosText}

ARTICLES:
${articleList}

TASK:
Analyze these articles and select the MOST IMPORTANT article(s) for video generation. Consider scheduling context and avoid duplicating recent topics.

VIDEO FORMAT OPTIONS:
- "single_short" (60-90s, 1080x1920 vertical): Single breaking news story, urgent update, trending topic
  Examples: Earthquake warning, market crash, policy announcement
- "multi_short" (90-120s, 1080x1920 vertical): 2-6 related or complementary short stories combined
  Examples: Multiple tech updates, related policy changes, trending topic roundup
- "long" (4-6 min, 1920x1080 horizontal): In-depth analysis, complex story, detailed explanation
  Examples: Technology breakdown, historical context, policy analysis
  IMPORTANT: Long videos are for "timeless" stories (informative, long-term info, NOT breaking/quick news)

URGENCY GUIDANCE:
- "urgent": Breaking news requiring immediate coverage (earthquakes, major incidents, market crashes)
- "developing": Trending topics, time-sensitive updates, evolving stories
- "regular": Informative content, analysis, educational material

DAILY FORMAT MIX TARGETS:
- Soft target for full 24h cycle: ~12 total videos
- Soft format target: ~4 long, ~4 single_short, ~4 multi_short
- These are guidance targets, not strict caps; adapt to real news quality and urgency
- Long videos are for "timeless" stories (informative, long-term info, NOT breaking/quick news)
- If no timeless stories exist in current cycle, long can be lower
- If breaking news dominates, favor short formats while still trying to rebalance later slots

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
- EXCLUDE: Near-duplicate angles from past 36h history unless there is meaningful development

SELECTION CRITERIA:
1. IMPORTANCE: Impact on society, public interest, significance
2. TIMELINESS: Breaking news, trending topics, time-sensitive updates
3. CLARITY: Story is clear and can be explained effectively
4. ENGAGEMENT: Likely to capture viewer attention
5. NOVELTY: Avoid near-repeats from recent coverage unless there is a material update
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
- For multi_short: select 2-6 related/complementary stories (can be same story with updates or related topics)
- For multi_short with 5-6 stories: keep each story concise and avoid shallow duplication
- For long: select 2-8 different stories with multiple articles each (each slide covers 1 story, intelligently distribute content)
  - Can select multiple articles of the same story for comprehensive coverage
  - Focus on informative, long-term content (not quick breaking news)
- Set urgency based on story nature and timing needs
- Follow PRIORITY guidance above when choosing video_format
- Reduce repetition using past 36h history, but allow follow-ups for developing stories
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
   - Include BOLD text overlay that COMPLIMENTS the video title to maximize click-through
   - Describe BOTH: catchy background image AND specific text to place on thumbnail
   - Make it attention-grabbing and clickable (especially critical for long videos)
   - Use high contrast, bold, readable text style
   - NO BRANDING IN IMAGES: Do NOT include channel logos, watermarks, branding elements, subscribe buttons, social media icons, or visual CTAs in any image descriptions (including thumbnail and last slide)

RESPONSE FORMAT (JSON only):
{
  "title": "SEO-optimized YouTube title in article language (REQUIRED - must always be provided)",
  "description": "SEO-optimized description in article language (REQUIRED - must always be provided)",
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
- Title MUST be provided (never null/undefined) - should be compelling and SEO-friendly for YouTube
- Description MUST be provided (never null/undefined) - should summarize the video and include keywords
- Each slide's audioNarration should match the estimatedDuration (10-20 seconds of speech)
- Ensure smooth information flow across all slides

Respond with ONLY the JSON object, no other text.`;
}

/**
 * Enhanced script generation input with full context
 */
export interface ScriptGenerationInputEnhanced {
  videoFormat: VideoFormat;
  urgency: UrgencyLevel;
  timeContext?: string;
  articles: AIArticleForScript[];
}

/**
 * Build enhanced script generation prompt with full context awareness
 * Single unified prompt - AI decides style/examples based on video format, urgency, and content
 */
export function buildScriptPromptEnhanced(input: ScriptGenerationInputEnhanced): string {
  const { videoFormat, urgency, timeContext, articles } = input;

  // Format articles for the prompt
  const articlesText = articles.map((article, idx) => {
    let text = `### Article ${idx + 1}: ${article.title}\n\n`;
    text += `Content:\n${article.contentText || article.content}\n\n`;

    if (article.images.length > 0) {
      text += `Reference Images:\n${article.images.join('\n')}\n\n`;
    }

    if (article.comments.length > 0) {
      const highEngagementComments = article.comments.filter(c => c.likes >= 10);
      const commentsToUse = highEngagementComments.length > 0
        ? highEngagementComments.slice(0, 5)
        : article.comments.slice(0, 5);

      if (commentsToUse.length > 0) {
        text += `Top Comments (for public reaction):\n`;
        commentsToUse.forEach(comment => {
          text += `- [${comment.likes} likes] ${comment.content}\n`;
          if (comment.replies && comment.replies.length > 0) {
            comment.replies.forEach(reply => { text += `  └ ${reply.content}\n`; });
          }
        });
        text += '\n';
      }
    }

    return text;
  }).join('\n---\n\n');

  const hasHighEngagementComments = articles.some(a => a.comments.some(c => c.likes >= 10));

  return `You are an AI video script writer for "J-Quick", creating structured video scripts for Japanese news content.

=== VIDEO CONTEXT ===
Video Format: ${videoFormat}
- single_short: 60-90s, 1080x1920 vertical, single breaking news story
- multi_short: 90-120s, 1080x1920 vertical, 2-6 related or complementary short stories
- long: 4-6 min, 1920x1080 horizontal, in-depth analysis (15-17 slides)

Urgency: ${urgency}
- urgent: Breaking, immediate, urgent tone (e.g., "Breaking right now", "Just in", "Alert")
- developing: Trending, evolving, updates-focused (e.g., "Trending now", "Everyone's talking about")
- regular: Informative, calm, educational (e.g., "Here's what you need to know", "Understanding")

Time Context: ${timeContext || 'General'}
- morning: Overnight news, quick updates
- lunch: Trending topics, lighter content
- evening: Day's highlights, recap

Channel Name: "J-Quick"

=== TITLE GUIDELINES (Choose appropriate style for this video format) ===

For single_short (short, punchy, urgent):
- "東京で震度5強の地震、緊急地震速報発表" (Earthquake with intensity 5-upper in Tokyo, emergency warning issued)
- "大手IT企業、従業員の30%を削減へ衝撃発表" (Major IT company announces shock 30% workforce reduction)
- "政府、新経済政策を承認 円相場に影響か" (Government approves new economic policy, may affect yen)

For multi_short (comprehensive, roundup, numbers, can cover 2-6 stories):
- "今日の日本テック業界3つの重大ニュース" (3 major news stories in Japan's tech industry today)
- "【速報】複数の政策変更が発表されます" (Breaking: Multiple policy changes announced)
- "気になるニュースを3つ紹介！" (Introducing 3 news stories you care about!)

For long (descriptive, in-depth, value-focused):
- "【徹底解説】日本の新経済政策があなたに与える影響" (In-depth: How Japan's new economic policy affects you)
- "最新テック規制の完全ガイド 変更点をわかりやすく" (Complete guide to latest tech regulations, changes explained simply)
- "この法律が日本のデジタル景観をどう変えるのか" (How this law will change Japan's digital landscape)

=== ARTICLES ===
${articlesText}

=== REQUIREMENTS ===

1. LANGUAGE:
   - ALL text fields (title, description, headline, audioNarration) MUST be in Japanese
   - Use natural, conversational Japanese appropriate for news narration
   - Image descriptions MUST be in English (for image generation AI)

2. TITLE (REQUIRED):
   - Choose style appropriate for video format (see guidelines above)
   - Make it compelling, SEO-friendly for YouTube
   - Consider urgency level (urgent = more urgent language, regular = more descriptive)
   - MUST ALWAYS include a title - never omit this field

3. SLIDE COUNT:
   - single_short/multi_short: 6-8 slides, each 10-20 seconds
   - long: 15-17 slides, each 10-20 seconds
   - Distribute information smoothly across slides
   - For multi_short with 4-6 stories: give each story a concise segment, merge closely related updates, avoid repeating the same angle

4. IMAGE DESCRIPTIONS (EXTREME DETAIL REQUIRED - English):

   EVERY image description must include ALL of these elements:

   a) COMPOSITION & LAYOUT:
      - Exact position (left/center/right, foreground/background)
      - Camera angle (close-up, medium, wide, bird's eye, Dutch angle)
      - Framing (what's included/excluded)

   b) LIGHTING & ATMOSPHERE:
      - Type (sunlight, fluorescent, neon, spotlight)
      - Direction (front, side, back, overhead)
      - Time of day (golden hour, noon, twilight)
      - Mood (optimistic, tense, mysterious, professional)

   c) BACKGROUND & CONTEXT:
      - Complete environment (office, street, lab, etc.)
      - Background elements (skyscrapers, screens, equipment)
      - Color palette
      - Cultural markers (Japanese architecture, convenience stores, train stations)

   d) SUBJECT DETAILS:
      - People: age, gender, clothing (specific items, colors), pose, expression
      - Objects: material, texture, size, condition
      - Scenes: activity, spatial relationships

   e) VISUAL CONSISTENCY:
      - Name recurring characters: "Ken Tanaka, middle-aged Japanese businessman in navy blue suit"
      - Maintain consistent appearance across slides

   f) TEXT ON IMAGES (CRITICAL - EXACT JAPANESE TEXT):
      - Add text when it enhances storytelling (signs, headlines, screens, documents)
      - Use EXACT Japanese text matching the story context
      - NO generic text like "重要なニュース" or "速報"
      - Use realistic text: company names, policy titles, location names
      - Examples: "渋谷駅 Shibuya Station", "経済政策変更について", "日本銀行"

   g) CULTURAL ACCURACY:
      - Japanese stories = Japanese settings, people, architecture
      - Use realistic Japanese signage and text

   h) DEFAULTS:
      - Default to male figures unless story requires female
      - For women: full modest attire, no skin showing, prefer masks/loose clothing
      - Prefer angles not showing faces (behind, far, blurred, silhouette)

5. THUMBNAIL DESIGN (English description):

   Must include ALL of these elements:
   - EXACT Japanese text overlay (complements video title, not repeating it)
   - Neon glow/border (2-3px, bright colors: red, cyan, yellow)
   - Arrows pointing to main subject/focus
   - Lens flares or light rays behind text
   - Slight vignette
   - Centered main subject with dynamic angle
   - High contrast, saturated colors

   Example: "Background: Low-angle shot of Japanese government building entrance with storm clouds, warm interior light spilling onto steps. Text overlay: '緊急発表 重要' in bold white with thick red neon border (3px) and dramatic drop shadow. Design: Red downward arrow pointing to text, cyan lens flare behind, subtle vignette."

6. AUDIO NARRATION (Japanese):

   a) WRITING STYLE:
      - Conversational, natural Japanese for speech (not writing style)
      - Short sentences for better TTS rendering
      - Include natural pauses

   b) AUDIO PROFILE (choose per slide):
      - urgent: Fast-paced, breaking news tone
      - calm: Measured, reassuring, explanatory
      - excited: Energetic, enthusiastic, positive
      - serious: Grave, important, weighty
      - casual: Relaxed, friendly, conversational
      - dramatic: Heightened emotion, building tension

   c) DIRECTOR'S NOTES (English - for TTS):
      Provide specific guidance:
      - Overall emotion: "concerned but professional", "optimistic forward-looking"
      - Pacing: "slower for emphasis", "quick and urgent"
      - Tone shifts: "start serious, become hopeful at end"
      - Emphasis: "emphasize 'shocking'", "soften tone for statistics"
      - Pauses: "pause before final statement", "brief pause after question"

   d) SMOOTH FLOW ACROSS SLIDES:
      - Maintain emotional consistency across related slides
      - Gradually build/release tension across narrative arc
      - Avoid jarring transitions (e.g., excited → serious → excited)
      - Consider progression: hook (urgent) → facts (calm/serious) → context (casual) → CTA (excited)

7. PUBLIC REACTION${hasHighEngagementComments ? ': Include 1-2 slides on public reaction (attribute generally, don\'t quote verbatim)' : ': Focus on story facts (no high-engagement comments available)'}

8. CTA:
   - Mention appropriate call-to-action at END of last slide narration:
     - urgent: "緊急情報はJ-Quickでチェックしてね" (Check J-Quick for breaking updates)
     - developing: "続報はJ-Quickで" (See updates on J-Quick)
     - regular: "J-Quickをチャンネル登録してね" (Subscribe to J-Quick for more Japanese news)

9. FACT INTEGRITY:
   - ONLY use information from provided articles
   - Never add facts not in source

10. NO BRANDING:
    - Image descriptions must NOT include: logos, watermarks, branding, subscribe buttons, social icons

=== RESPONSE FORMAT (JSON only) ===
{
  "title": "SEO-optimized YouTube title in Japanese (REQUIRED - must always be provided)",
  "description": "SEO-optimized description in Japanese (REQUIRED - must always be provided)",
  "thumbnailDescription": "Detailed thumbnail image prompt in English with neon/borders/arrows",
  "slides": [
    {
      "headline": "Short slide title in Japanese",
      "imageDescription": "Detailed image prompt in English with all required elements",
      "audioNarration": "Narration text in conversational Japanese",
      "estimatedDuration": 15,
      "audioProfile": "urgent" | "calm" | "excited" | "serious" | "casual" | "dramatic",
      "directorNotes": "TTS style/emotion/tone instructions in English"
    }
  ]
}

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

GRID SEPARATION (CRITICAL):
- Use EXACTLY 1-3 pixels of visual separation between cells
- DO NOT create wide margins (20-100 pixels) - cells should be close together
- A thin 1-3 pixel divider line or gap is sufficient

FRAME ISOLATION (CRITICAL):
- Each cell's content must stay STRICTLY within its boundaries
- No text may cross cell borders
- No object edges (people, items) may extend beyond their cell's area
- Cell 0, Cell 1, Cell 2 etc. are separate frames - content must not bleed between them

CHARACTER CONSISTENCY:
- While frames are isolated, shared characters should maintain visual consistency
- If the same person appears in multiple cells, they should look the same (clothing, appearance)
- This is about visual consistency, NOT about objects crossing boundaries

STYLE REQUIREMENTS:
- Consistent visual style across ALL cells
- ${isShort ? 'Dramatic, attention-grabbing visuals suitable for social media shorts' : 'Professional, cinematic quality suitable for YouTube videos'}
- High contrast, vibrant colors
- Clear focal points in each cell
- Modern, polished aesthetic

CELL CONTENTS:
${cellDescriptions}${thumbnailSection}${emptySection}

CRITICAL: Generate exactly ONE image with all cells combined. Do NOT generate separate images.
`.trim();
}

/**
 * Build individual slide image generation prompt
 * Used for non-pro model (gemini-2.5-flash-image) with individual slide generation
 * @param options Individual slide prompt options
 * @returns Complete prompt string for individual slide generation
 */
export function buildIndividualSlidePrompt(options: {
  slideHeadline: string;
  imageDescription: string;
  width: number;
  height: number;
  aspectRatio: string;
}): string {
  const { slideHeadline, imageDescription, width, height, aspectRatio } = options;

  return `
TASK: Generate a single ${width}x${height} pixel image (${aspectRatio} aspect ratio).

SUBJECT: ${slideHeadline}

DESCRIPTION: ${imageDescription}

STYLE REQUIREMENTS:
- High quality, detailed image
- High contrast, vibrant colors
- Clear focal point
- Modern, polished aesthetic
- ${aspectRatio === '9:16' ? 'Vertical composition optimized for mobile viewing' : 'Horizontal composition optimized for desktop viewing'}

Generate exactly ONE image.
`.trim();
}
