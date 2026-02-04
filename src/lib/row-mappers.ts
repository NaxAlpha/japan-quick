/**
 * Row mappers for database results.
 * Converts snake_case database columns to camelCase TypeScript interfaces.
 *
 * These mappers extract the common pattern of mapping database rows to typed objects,
 * reducing duplication across routes, workflows, and services.
 */

import type {
  Article,
  ArticleVersion,
  ArticleComment,
} from '../types/article.js';
import type {
  Video,
  CostLog,
  VideoAsset,
} from '../types/video.js';
import type {
  YouTubeAuthRecord,
} from '../types/youtube.js';

/**
 * Maps a database row to an Article object.
 * Converts snake_case columns to camelCase properties.
 *
 * @param row - Database row from articles table
 * @returns Typed Article object
 */
export function mapDbRowToArticle(row: Record<string, unknown>): Article {
  return {
    id: row.id as number,
    pickId: row.pick_id as string,
    articleId: row.article_id as string | undefined,
    articleUrl: row.article_url as string | undefined,
    status: row.status as Article['status'],
    title: row.title as string | undefined,
    source: row.source as string | undefined,
    thumbnailUrl: row.thumbnail_url as string | undefined,
    publishedAt: row.published_at as string | undefined,
    modifiedAt: row.modified_at as string | undefined,
    detectedAt: row.detected_at as string,
    firstScrapedAt: row.first_scraped_at as string | undefined,
    secondScrapedAt: row.second_scraped_at as string | undefined,
    scheduledRescrapeAt: row.scheduled_rescrape_at as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Maps a database row to an ArticleVersion object.
 * Converts snake_case columns to camelCase properties.
 *
 * @param row - Database row from article_versions table
 * @returns Typed ArticleVersion object
 */
export function mapDbRowToArticleVersion(row: Record<string, unknown>): ArticleVersion {
  return {
    id: row.id as number,
    articleId: row.article_id as number,
    version: row.version as number,
    content: row.content as string,
    contentText: row.content_text as string | undefined,
    pageCount: row.page_count as number,
    images: row.images as string | undefined,
    scrapedAt: row.scraped_at as string,
    createdAt: row.created_at as string,
  };
}

/**
 * Maps a database row to an ArticleComment object.
 * Converts snake_case columns to camelCase properties.
 *
 * @param row - Database row from article_comments table
 * @returns Typed ArticleComment object
 */
export function mapDbRowToArticleComment(row: Record<string, unknown>): ArticleComment {
  return {
    id: row.id as number,
    articleId: row.article_id as number,
    version: row.version as number,
    commentId: row.comment_id as string | undefined,
    author: row.author as string | undefined,
    content: row.content as string,
    postedAt: row.posted_at as string | undefined,
    likes: row.likes as number,
    repliesCount: row.replies_count as number,
    reactionsEmpathized: row.reactions_empathized as number,
    reactionsUnderstood: row.reactions_understood as number,
    reactionsQuestioning: row.reactions_questioning as number,
    replies: row.replies as string | undefined,
    scrapedAt: row.scraped_at as string,
    createdAt: row.created_at as string,
  };
}

/**
 * Maps a database row to a Video object.
 * Converts snake_case columns to camelCase properties.
 *
 * Note: This returns the raw Video interface. For frontend use,
 * use parseVideo() from src/types/video.js to parse JSON fields.
 *
 * @param row - Database row from videos table
 * @returns Typed Video object
 */
export function mapDbRowToVideo(row: Record<string, unknown>): Video {
  return {
    id: row.id as number,
    notes: row.notes as string | null,
    short_title: row.short_title as string | null,
    articles: row.articles as string | null,
    video_type: row.video_type as Video['video_type'],
    selection_status: row.selection_status as Video['selection_status'],
    total_cost: row.total_cost as number,
    script: row.script as string | null,
    script_status: row.script_status as Video['script_status'],
    script_error: row.script_error as string | null,
    asset_status: row.asset_status as Video['asset_status'],
    asset_error: row.asset_error as string | null,
    image_model: row.image_model as Video['image_model'],
    tts_model: row.tts_model as Video['tts_model'],
    tts_voice: row.tts_voice as Video['tts_voice'],
    render_status: row.render_status as Video['render_status'],
    render_error: row.render_error as string | null,
    render_started_at: row.render_started_at as string | null,
    render_completed_at: row.render_completed_at as string | null,
    slide_image_asset_ids: row.slide_image_asset_ids as string | null,
    slide_audio_asset_ids: row.slide_audio_asset_ids as string | null,
    youtube_upload_status: row.youtube_upload_status as Video['youtube_upload_status'],
    youtube_upload_error: row.youtube_upload_error as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    // Optional fields that may not exist yet
    video_format: (row.video_format as Video['video_format'] | null) || null,
    urgency: (row.urgency as Video['urgency'] | null) || null,
  };
}

/**
 * Maps a database row to a CostLog object.
 * Converts snake_case columns to camelCase properties.
 *
 * @param row - Database row from cost_logs table
 * @returns Typed CostLog object
 */
export function mapDbRowToCostLog(row: Record<string, unknown>): CostLog {
  return {
    id: row.id as number,
    video_id: row.video_id as number,
    log_type: row.log_type as string,
    model_id: row.model_id as string,
    attempt_id: row.attempt_id as number,
    input_tokens: row.input_tokens as number | null,
    output_tokens: row.output_tokens as number | null,
    cost: row.cost as number,
    created_at: row.created_at as string,
  };
}

/**
 * Maps a database row to a VideoAsset object.
 * Converts snake_case columns to camelCase properties.
 *
 * @param row - Database row from video_assets table
 * @returns Typed VideoAsset object
 */
export function mapDbRowToVideoAsset(row: Record<string, unknown>): VideoAsset {
  return {
    id: row.id as number,
    video_id: row.video_id as number,
    asset_type: row.asset_type as VideoAsset['asset_type'],
    asset_index: row.asset_index as number,
    r2_key: row.r2_key as string,
    mime_type: row.mime_type as string,
    file_size: row.file_size as number | null,
    metadata: row.metadata as string | null,
    public_url: row.public_url as string | null,
    generation_type: row.generation_type as string,
    created_at: row.created_at as string,
  };
}

/**
 * Maps a database row to a YouTubeAuthRecord object.
 * Converts snake_case columns to camelCase properties.
 *
 * @param row - Database row from youtube_auth table
 * @returns Typed YouTubeAuthRecord object
 */
export function mapDbRowToYouTubeAuth(row: Record<string, unknown>): YouTubeAuthRecord {
  return {
    id: row.id as number,
    channel_id: row.channel_id as string,
    channel_title: row.channel_title as string | null,
    access_token: row.access_token as string,
    refresh_token: row.refresh_token as string,
    token_type: row.token_type as string,
    scopes: row.scopes as string,
    expires_at: row.expires_at as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
