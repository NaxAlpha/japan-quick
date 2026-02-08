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
