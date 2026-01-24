/**
 * Article API routes
 * GET /api/articles/:id - Get article by pick:xxx or article_id
 * GET /api/articles/:id/version/:version - Get specific version
 * POST /api/articles/trigger/:pickId - Manual trigger
 * GET /api/articles/status/:workflowId - Workflow status
 */

import { Hono } from 'hono';
import type { Env } from '../types/news.js';
import type { Article, ArticleVersion, ArticleComment, ArticleScraperParams, ArticleScraperResult } from '../types/article.js';
import { log, generateRequestId } from '../lib/logger.js';

const articleRoutes = new Hono<{ Bindings: Env['Bindings'] }>();

// Helper to convert DB row to Article object
function rowToArticle(row: Record<string, unknown>): Article {
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
    updatedAt: row.updated_at as string
  };
}

// Helper to convert DB row to ArticleVersion object
function rowToVersion(row: Record<string, unknown>): ArticleVersion {
  return {
    id: row.id as number,
    articleId: row.article_id as number,
    version: row.version as number,
    content: row.content as string,
    contentText: row.content_text as string | undefined,
    pageCount: row.page_count as number,
    images: row.images as string | undefined,
    scrapedAt: row.scraped_at as string,
    createdAt: row.created_at as string
  };
}

// Helper to convert DB row to ArticleComment object
function rowToComment(row: Record<string, unknown>): ArticleComment {
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
    scrapedAt: row.scraped_at as string,
    createdAt: row.created_at as string
  };
}

// GET /api/articles/:id - Get article by pick:xxx or article_id
articleRoutes.get('/:id', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  const id = c.req.param('id');
  log.articleRoutes.info(reqId, 'Request received', { method: 'GET', path: `/:id`, id });

  try {
    let article: Record<string, unknown> | null = null;

    // Check if id is in format "pick:xxx"
    if (id.startsWith('pick:')) {
      const pickId = id.substring(5);
      article = await c.env.DB.prepare(
        'SELECT * FROM articles WHERE pick_id = ?'
      ).bind(pickId).first();
    } else {
      // Try to find by article_id
      article = await c.env.DB.prepare(
        'SELECT * FROM articles WHERE article_id = ?'
      ).bind(id).first();
    }

    if (!article) {
      log.articleRoutes.warn(reqId, 'Article not found', { id });
      return c.json({
        success: false,
        error: 'Article not found'
      }, 404);
    }

    const articleObj = rowToArticle(article);

    // Get all versions
    const versionsResult = await c.env.DB.prepare(
      'SELECT * FROM article_versions WHERE article_id = ? ORDER BY version ASC'
    ).bind(articleObj.id).all();

    const versions = versionsResult.results.map(row =>
      rowToVersion(row as Record<string, unknown>)
    );

    // Get comments for latest version
    const latestVersion = versions.length > 0 ? versions[versions.length - 1].version : 0;
    const commentsResult = await c.env.DB.prepare(
      'SELECT * FROM article_comments WHERE article_id = ? AND version = ? ORDER BY likes DESC'
    ).bind(articleObj.id, latestVersion).all();

    const comments = commentsResult.results.map(row =>
      rowToComment(row as Record<string, unknown>)
    );

    return c.json({
      success: true,
      article: articleObj,
      versions,
      comments
    });
  } catch (error) {
    log.articleRoutes.error(reqId, 'Request failed', error as Error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get article'
    }, 500);
  } finally {
    const durationMs = Date.now() - startTime;
    log.articleRoutes.info(reqId, 'Request completed', { status: 200, durationMs });
  }
});

// GET /api/articles/:id/version/:version - Get specific version
articleRoutes.get('/:id/version/:version', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  const id = c.req.param('id');
  const versionNum = parseInt(c.req.param('version'), 10);
  log.articleRoutes.info(reqId, 'Request received', { method: 'GET', path: `/:id/version/:version`, id, version: versionNum });

  try {
    let article: Record<string, unknown> | null = null;

    if (id.startsWith('pick:')) {
      const pickId = id.substring(5);
      article = await c.env.DB.prepare(
        'SELECT * FROM articles WHERE pick_id = ?'
      ).bind(pickId).first();
    } else {
      article = await c.env.DB.prepare(
        'SELECT * FROM articles WHERE article_id = ?'
      ).bind(id).first();
    }

    if (!article) {
      log.articleRoutes.warn(reqId, 'Article not found', { id });
      return c.json({
        success: false,
        error: 'Article not found'
      }, 404);
    }

    const articleObj = rowToArticle(article);

    // Get specific version
    const version = await c.env.DB.prepare(
      'SELECT * FROM article_versions WHERE article_id = ? AND version = ?'
    ).bind(articleObj.id, versionNum).first();

    if (!version) {
      log.articleRoutes.warn(reqId, 'Version not found', { id, version: versionNum });
      return c.json({
        success: false,
        error: 'Version not found'
      }, 404);
    }

    const versionObj = rowToVersion(version as Record<string, unknown>);

    // Get comments for this version
    const commentsResult = await c.env.DB.prepare(
      'SELECT * FROM article_comments WHERE article_id = ? AND version = ? ORDER BY likes DESC'
    ).bind(articleObj.id, versionNum).all();

    const comments = commentsResult.results.map(row =>
      rowToComment(row as Record<string, unknown>)
    );

    return c.json({
      success: true,
      article: articleObj,
      version: versionObj,
      comments
    });
  } catch (error) {
    log.articleRoutes.error(reqId, 'Request failed', error as Error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get article version'
    }, 500);
  } finally {
    const durationMs = Date.now() - startTime;
    log.articleRoutes.info(reqId, 'Request completed', { status: 200, durationMs });
  }
});

// POST /api/articles/trigger/:pickId - Manual trigger
articleRoutes.post('/trigger/:pickId', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  const pickId = c.req.param('pickId');
  log.articleRoutes.info(reqId, 'Request received', { method: 'POST', path: `/trigger/${pickId}` });

  try {
    const body = await c.req.json<{ isRescrape?: boolean }>().catch(() => ({}));

    const params: ArticleScraperParams = {
      pickId,
      isRescrape: body.isRescrape ?? false
    };

    // Create workflow instance
    const instance = await c.env.ARTICLE_SCRAPER_WORKFLOW.create({
      params
    });

    log.articleRoutes.info(reqId, 'Workflow created', { workflowId: instance.id, pickId });
    return c.json({
      success: true,
      workflowId: instance.id,
      pickId
    });
  } catch (error) {
    log.articleRoutes.error(reqId, 'Request failed', error as Error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create workflow'
    }, 500);
  } finally {
    const durationMs = Date.now() - startTime;
    log.articleRoutes.info(reqId, 'Request completed', { status: 200, durationMs });
  }
});

// GET /api/articles/status/:workflowId - Workflow status
articleRoutes.get('/status/:workflowId', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();
  const workflowId = c.req.param('workflowId');
  log.articleRoutes.info(reqId, 'Request received', { method: 'GET', path: `/status/${workflowId}` });

  try {
    const instance = await c.env.ARTICLE_SCRAPER_WORKFLOW.get(workflowId);

    if (!instance) {
      log.articleRoutes.warn(reqId, 'Workflow not found', { workflowId });
      return c.json({
        success: false,
        error: 'Workflow not found'
      }, 404);
    }

    const status = await instance.status();

    return c.json({
      success: true,
      workflowId: instance.id,
      status: status.status,
      output: status.output as ArticleScraperResult | undefined
    });
  } catch (error) {
    log.articleRoutes.error(reqId, 'Request failed', error as Error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get workflow status'
    }, 500);
  } finally {
    const durationMs = Date.now() - startTime;
    log.articleRoutes.info(reqId, 'Request completed', { status: 200, durationMs });
  }
});

export { articleRoutes };
