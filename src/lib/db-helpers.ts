/**
 * Database helper functions for common SQL patterns.
 * Extracts duplicated SQL operations across routes, workflows, and services.
 */

import type {
  Article,
  ArticleVersion,
  ArticleComment,
  ScrapedArticleData,
  ScrapedComment,
  ArticleStatus,
} from '../types/article.js';

/**
 * Upsert article into database.
 * Creates new article or updates existing one based on pick_id.
 */
export async function upsertArticle(
  db: D1Database,
  params: {
    pickId: string;
    status: ArticleStatus;
    articleUrl?: string;
    articleId?: string;
    title?: string;
    source?: string;
    thumbnailUrl?: string;
    publishedAt?: string;
    modifiedAt?: string;
    detectedAt?: string;
  }
): Promise<number> {
  const {
    pickId,
    status,
    articleUrl,
    articleId,
    title,
    source,
    thumbnailUrl,
    publishedAt,
    modifiedAt,
    detectedAt,
  } = params;

  // Check if article exists
  const existing = await db
    .prepare('SELECT id FROM articles WHERE pick_id = ?')
    .bind(pickId)
    .first<{ id: number }>();

  if (existing) {
    // Update existing article
    await db
      .prepare(
        `UPDATE articles SET
          article_id = ?,
          article_url = ?,
          title = ?,
          source = ?,
          thumbnail_url = ?,
          published_at = ?,
          modified_at = ?,
          status = ?,
          updated_at = datetime('now')
        WHERE id = ?`
      )
      .bind(
        articleId ?? null,
        articleUrl ?? null,
        title ?? null,
        source ?? null,
        thumbnailUrl ?? null,
        publishedAt ?? null,
        modifiedAt ?? null,
        status,
        existing.id
      )
      .run();

    return existing.id;
  }

  // Insert new article
  const result = await db
    .prepare(
      `INSERT INTO articles (
        pick_id, article_id, article_url, status, title, source,
        thumbnail_url, published_at, modified_at, detected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      pickId,
      articleId ?? null,
      articleUrl ?? null,
      status,
      title ?? null,
      source ?? null,
      thumbnailUrl ?? null,
      publishedAt ?? null,
      modifiedAt ?? null,
      detectedAt ?? "datetime('now')"
    )
    .run();

  if (!result.meta.last_row_id) {
    throw new Error(`Failed to create article for pick_id: ${pickId}`);
  }

  return result.meta.last_row_id;
}

/**
 * Update article status with optional timestamp fields.
 * Used for marking articles as scraped_v1 or scraped_v2.
 */
export async function updateArticleStatus(
  db: D1Database,
  articleId: number,
  status: ArticleStatus,
  options?: {
    firstScrapedAt?: boolean;
    secondScrapedAt?: boolean;
    scheduleRescrape?: boolean;
    rescrapeMinutes?: number;
  }
): Promise<void> {
  const { firstScrapedAt, secondScrapedAt, scheduleRescrape, rescrapeMinutes = 15 } = options ?? {};

  const updates: string[] = ['status = ?', 'updated_at = datetime(\'now\')'];
  const values: (string | number)[] = [status];

  if (firstScrapedAt) {
    updates.push('first_scraped_at = datetime(\'now\')');
  }
  if (secondScrapedAt) {
    updates.push('second_scraped_at = datetime(\'now\')');
  }
  if (scheduleRescrape) {
    updates.push(`scheduled_rescrape_at = datetime('now', '+${rescrapeMinutes} minutes')`);
  } else if (secondScrapedAt) {
    updates.push('scheduled_rescrape_at = NULL');
  }

  values.push(articleId);

  await db
    .prepare(`UPDATE articles SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
}

/**
 * Upsert article version into database.
 * Creates new version or updates existing one.
 */
export async function upsertArticleVersion(
  db: D1Database,
  params: {
    articleId: number;
    version: number;
    content: string;
    contentText?: string;
    pageCount?: number;
    images?: string[];
  }
): Promise<number> {
  const { articleId, version, content, contentText, pageCount = 1, images } = params;

  const result = await db
    .prepare(
      `INSERT INTO article_versions (
        article_id, version, content, content_text, page_count, images, scraped_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(article_id, version) DO UPDATE SET
        content = excluded.content,
        content_text = excluded.content_text,
        page_count = excluded.page_count,
        images = excluded.images,
        scraped_at = excluded.scraped_at`
    )
    .bind(
      articleId,
      version,
      content,
      contentText ?? null,
      pageCount,
      images ? JSON.stringify(images) : null
    )
    .run();

  if (!result.meta.last_row_id) {
    throw new Error(`Failed to upsert version for article_id: ${articleId}`);
  }

  return result.meta.last_row_id;
}

/**
 * Upsert article comments into database.
 * Deletes old comments and inserts new ones.
 */
export async function upsertArticleComments(
  db: D1Database,
  params: {
    articleId: number;
    version: number;
    comments: ScrapedComment[];
  }
): Promise<void> {
  const { articleId, version, comments } = params;

  // Delete old comments
  await db
    .prepare('DELETE FROM article_comments WHERE article_id = ? AND version = ?')
    .bind(articleId, version)
    .run();

  // Insert new comments
  if (comments.length === 0) {
    return;
  }

  const stmt = db.prepare(
    `INSERT INTO article_comments (
      article_id, version, comment_id, author, content, posted_at,
      likes, replies_count, reactions_empathized, reactions_understood,
      reactions_questioning, replies, scraped_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );

  for (const comment of comments) {
    await stmt
      .bind(
        articleId,
        version,
        comment.commentId ?? null,
        comment.author ?? null,
        comment.content,
        comment.postedAt ?? null,
        comment.likes,
        comment.repliesCount,
        comment.reactions.empathized,
        comment.reactions.understood,
        comment.reactions.questioning,
        comment.replies.length > 0 ? JSON.stringify(comment.replies) : null
      )
      .run();
  }
}

/**
 * Get article by pick_id with optional ID-only result.
 */
export async function getArticleByPickId(
  db: D1Database,
  pickId: string,
  options?: { idOnly?: boolean }
): Promise<Article | { id: number; status: string } | null> {
  const { idOnly } = options ?? {};

  const query = idOnly
    ? 'SELECT id, status FROM articles WHERE pick_id = ?'
    : 'SELECT * FROM articles WHERE pick_id = ?';

  const result = await db.prepare(query).bind(pickId).first();
  return (result as Article | { id: number; status: string } | null) ?? null;
}

/**
 * Get article with all versions and comments.
 * Used for article detail page API.
 */
export async function getArticleWithVersions(
  db: D1Database,
  pickId: string
): Promise<{ article: Article | null; versions: ArticleVersion[]; comments: ArticleComment[] }> {
  const article = await db
    .prepare('SELECT * FROM articles WHERE pick_id = ?')
    .bind(pickId)
    .first() as Article | null;

  if (!article) {
    return { article: null, versions: [], comments: [] };
  }

  const versions = await db
    .prepare(
      `SELECT id, article_id as articleId, version, content, content_text as contentText,
        page_count as pageCount, images, scraped_at as scrapedAt, created_at as createdAt
      FROM article_versions WHERE article_id = ? ORDER BY version DESC`
    )
    .bind(article.id)
    .all() as unknown as ArticleVersion[];

  const comments = await db
    .prepare(
      `SELECT id, article_id as articleId, version, comment_id as commentId, author, content,
        posted_at as postedAt, likes as likes, replies_count as repliesCount,
        reactions_empathized as reactionsEmpathized,
        reactions_understood as reactionsUnderstood,
        reactions_questioning as reactionsQuestioning,
        replies as replies, scraped_at as scrapedAt, created_at as createdAt
      FROM article_comments WHERE article_id = ? ORDER BY id ASC`
    )
    .bind(article.id)
    .all() as unknown as ArticleComment[];

  return { article, versions, comments };
}

/**
 * Get comments for a specific article version.
 */
export async function getCommentsByVersion(
  db: D1Database,
  articleId: number,
  version: number
): Promise<ArticleComment[]> {
  const comments = await db
    .prepare(
      `SELECT id, article_id as articleId, version, comment_id as commentId, author, content,
        posted_at as postedAt, likes as likes, replies_count as repliesCount,
        reactions_empathized as reactionsEmpathized,
        reactions_understood as reactionsUnderstood,
        reactions_questioning as reactionsQuestioning,
        replies as replies, scraped_at as scrapedAt, created_at as createdAt
      FROM article_comments WHERE article_id = ? AND version = ? ORDER BY id ASC`
    )
    .bind(articleId, version)
    .all() as unknown as ArticleComment[];

  return comments;
}

/**
 * Get articles by status with optional limit.
 * Used for finding articles due for processing.
 */
export async function getArticlesByStatus(
  db: D1Database,
  status: ArticleStatus,
  options?: { limit?: number; orderBy?: string }
): Promise<Article[]> {
  const { limit, orderBy = 'detected_at DESC' } = options ?? {};

  let query = `SELECT * FROM articles WHERE status = ? ORDER BY ${orderBy}`;
  if (limit) {
    query += ` LIMIT ${limit}`;
  }

  const articles = await db.prepare(query).bind(status).all();
  return articles.results as Article[];
}

/**
 * Get articles for video selection.
 * Filters by scraped_v2 status from last 24 hours and excludes already used articles.
 */
export async function getEligibleArticlesForVideo(
  db: D1Database,
  options?: { hoursAgo?: number; limit?: number }
): Promise<Article[]> {
  const { hoursAgo = 24, limit } = options ?? {};

  let query = `
    SELECT a.* FROM articles a
    WHERE a.status = 'scraped_v2'
      AND a.detected_at >= datetime('now', '-${hoursAgo} hours')
      AND NOT EXISTS (
        SELECT 1 FROM videos v
        WHERE json_extract(v.articles, '$') LIKE '%' || a.pick_id || '%'
      )
    ORDER BY a.detected_at DESC
  `;

  if (limit) {
    query += ` LIMIT ${limit}`;
  }

  const articles = await db.prepare(query).all();
  return articles.results as Article[];
}

/**
 * Create initial article entry with pending status.
 * Used when detecting new articles from news scraping.
 */
export async function createArticleEntry(
  db: D1Database,
  pickId: string,
  detectedAt?: string
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO articles (pick_id, status, detected_at)
      VALUES (?, 'pending', ?)`
    )
    .bind(pickId, detectedAt ?? "datetime('now')")
    .run();

  if (!result.meta.last_row_id) {
    throw new Error(`Failed to create article entry for pick_id: ${pickId}`);
  }

  return result.meta.last_row_id;
}

/**
 * Check and return article for scraping.
 * Returns null if article doesn't exist or is already processed.
 */
export async function checkArticleForScraping(
  db: D1Database,
  pickId: string
): Promise<{ id: number; status: string } | null> {
  return getArticleByPickId(db, pickId, { idOnly: true }) as Promise<{ id: number; status: string } | null>;
}
