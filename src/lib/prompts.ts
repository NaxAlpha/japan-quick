/**
 * Prompts Module - Centralized AI prompt templates
 * Provides consistent, maintainable prompt strings for AI operations
 */

import type { AIArticleInputWithContent, PastVideoContext, VideoFormat, UrgencyLevel, AIArticleForScript } from '../types/video.js';

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
    formatsToday: {
      single_short: number;
      multi_short: number;
      long: number;
    };
    remainingTargets: {
      long: number;
      single_short: number;
    };
  }
): string {
  const { currentTimeJST, videosCreatedToday, totalDailyTarget, formatsToday, remainingTargets } = schedulingContext;
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

FORMAT MIX TODAY:
- Long Videos: ${formatsToday.long}/4 created, ${remainingTargets.long} remaining
- Single Shorts: ${formatsToday.single_short}/3 created, ${remainingTargets.single_short} remaining
- Multi Shorts: ${formatsToday.multi_short} created

PRIORITY (use this to decide video_format):
1. If long videos < 4 and timeless/educational stories exist → prioritize "long"
2. If single_short < 3 and good single stories exist → prioritize "single_short"
3. Otherwise → "multi_short"

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
  IMPORTANT: Long videos are for "timeless" stories (informative, long-term info, NOT breaking/quick news)

URGENCY GUIDANCE:
- "urgent": Breaking news requiring immediate coverage (earthquakes, major incidents, market crashes)
- "developing": Trending topics, time-sensitive updates, evolving stories
- "regular": Informative content, analysis, educational material

DAILY FORMAT MIX TARGETS:
- MUST have at least 1 long video (ideally 2-3, maximum 4 per day)
- 2-3 single story shorts per day
- Remaining slots: multi-story shorts
- Long videos are for "timeless" stories (informative, long-term info, NOT breaking/quick news)
- If no timeless stories exist today, can skip long videos for that day
- If more than 4 timeless stories exist, do not exceed 4
- Can reduce long video count to 2-3 if breaking news is important

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
- For multi_short: select 2-3 related articles (can be same story or related topics)
- For long: select 2-8 different stories with multiple articles each (each slide covers 1 story, intelligently distribute content)
  - Can select multiple articles of the same story for comprehensive coverage
  - Focus on informative, long-term content (not quick breaking news)
- Set urgency based on story nature and timing needs
- Follow PRIORITY guidance above when choosing video_format
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
   - Include BOLD text overlay that COMPLIMENTS the video title to maximize click-through
   - Describe BOTH: catchy background image AND specific text to place on thumbnail
   - Make it attention-grabbing and clickable (especially critical for long videos)
   - Use high contrast, bold, readable text style
   - NO BRANDING IN IMAGES: Do NOT include channel logos, watermarks, branding elements, subscribe buttons, social media icons, or visual CTAs in any image descriptions (including thumbnail and last slide)

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
 * Single consistent prompt structure with context provided for AI to follow
 */
export function buildScriptPromptEnhanced(input: ScriptGenerationInputEnhanced): string {
  const { videoFormat, urgency, timeContext, articles } = input;

  // Format-specific context (provided to AI, not changing prompt structure)
  const formatContext = {
    single_short: {
      duration: '60-90 seconds',
      aspectRatio: '1080x1920 (vertical)',
      slideCount: '6-8 slides',
      structure: 'Hook/intro → Core facts → Context/impact → Optional: Public reaction → Conclusion/CTA'
    },
    multi_short: {
      duration: '90-120 seconds',
      aspectRatio: '1080x1920 (vertical)',
      slideCount: '6-8 slides',
      structure: 'Combined hook → Story 1 (2-3 slides) → Story 2 (2-3 slides) → [Optional: Story 3] → Combined conclusion'
    },
    long: {
      duration: '4-6 minutes',
      aspectRatio: '1920x1080 (horizontal)',
      slideCount: '15-17 slides',
      structure: 'Intro/Context → Background → Main story details → Public reaction → Analysis → Conclusion/Takeaways'
    }
  };

  // Urgency context (provided to AI)
  const urgencyContext = {
    urgent: {
      tone: 'Breaking, immediate, urgent',
      hooks: ['"Breaking right now:"', '"Just in:"', '"Alert:"'],
      cta: '"Follow for breaking updates - subscribe to J-Quick"'
    },
    developing: {
      tone: 'Trending, evolving, updates-focused',
      hooks: ['"Trending now in Japan:"', '"Here\'s what everyone\'s talking about:"', '"The story developing:"'],
      cta: '"Follow this developing story - see updates on J-Quick"'
    },
    regular: {
      tone: 'Informative, calm, educational',
      hooks: ['"Here\'s what you need to know:"', '"Understanding [topic]:"', '"The story behind:"'],
      cta: '"Subscribe for more Japanese news on J-Quick"'
    }
  };

  // Time context (provided to AI)
  const timeContextInfo = timeContext === 'morning' ? 'Morning update: overnight news, quick updates'
    : timeContext === 'lunch' ? 'Lunchtime: trending topics, lighter content'
    : timeContext === 'evening' ? 'Evening: day\'s highlights, recap'
    : 'General: no specific time context';

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

  const format = formatContext[videoFormat];
  const urg = urgencyContext[urgency];

  return `You are an AI video script writer for "J-Quick", creating structured video scripts for Japanese news content.

CONTEXT FOR THIS VIDEO:
- Video Format: ${videoFormat} (${format.duration}, ${format.aspectRatio})
- Target Slides: ${format.slideCount}
- Narrative Structure: ${format.structure}
- Urgency: ${urgency} (${urg.tone})
- Time Context: ${timeContextInfo}
- Suggested Hooks: ${urg.hooks.join(', ')}
- Suggested CTA: ${urg.cta}
- Channel Name: "J-Quick" (not "Japan Quick")

ARTICLES:
${articlesText}

TASK:
Create a compelling video script following the format structure above.

REQUIREMENTS:
1. Slide Count: Create ${format.slideCount}, each 10-20 seconds
2. Opening: Use urgency-appropriate hook, make it attention-grabbing
3. Language: Use article language for all text (title, description, narration), English for image descriptions
4. Images: Precise and detailed, reference provided images, prefer male unless story requires female, avoid showing faces when possible, match story location
5. Comments${hasHighEngagementComments ? ': Include 1-2 slides on public reaction (attribute generally, don\'t quote verbatim)' : ': Focus on story facts (no high-engagement comments)'}
6. Thumbnail: Compelling, matches story, includes bold text overlay that compliments the video title to maximize click-through rate
   - Describe BOTH: (1) catchy background image AND (2) specific text overlay to place on thumbnail
   - Thumbnail text should work WITH video title to make viewers want to click
   - Especially critical for long videos (4-6 min) - must be attention-grabbing
   - Use high contrast, bold, readable text style
7. CTA: Mention "${urg.cta}" at the END of the LAST slide's narration (do NOT create a separate CTA slide, just mention it at the end)
8. FACT INTEGRITY: ONLY use information from provided articles - never add facts not in source
9. NO BRANDING IN IMAGES: Image descriptions must NOT include:
   - Channel logos or watermarks (including "J-Quick" or any channel name text)
   - Branding elements or visual CTAs
   - Subscribe buttons or social media icons
   - Any text overlays except the title on the thumbnail
   This applies to ALL slides including the thumbnail and last slide.

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
