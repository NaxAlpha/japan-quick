/**
 * Article API routes
 * GET /api/articles/:id - Get article by pick:xxx or article_id
 * GET /api/articles/:id/version/:version - Get specific version
 * POST /api/articles/trigger/:pickId - Manual trigger
 * GET /api/articles/status/:workflowId - Workflow status
 */

import { Hono } from 'hono';
import type { Env } from '../types/env.js';
import type { Article, ArticleVersion, ArticleComment, ArticleScraperParams, ArticleScraperResult } from '../types/article.js';
import { log, generateRequestId } from '../lib/logger.js';
import { successResponse, notFoundResponse } from '../lib/api-response.js';
import { runRoute } from '../lib/route-helpers.js';
import {
  mapDbRowToArticle,
  mapDbRowToArticleVersion,
  mapDbRowToArticleComment,
} from '../lib/row-mappers.js';

const articleRoutes = new Hono<{ Bindings: Env['Bindings'] }>();

// GET /api/articles/:id - Get article by pick:xxx or article_id
articleRoutes.get('/:id', async (c) => {
  const reqId = generateRequestId();
  const id = c.req.param('id');
  return runRoute(log.articleRoutes, reqId, { method: 'GET', path: '/:id', id }, async () => {
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
      return notFoundResponse('Article');
    }

    const articleObj = mapDbRowToArticle(article);

    // Get all versions
    const versionsResult = await c.env.DB.prepare(
      'SELECT * FROM article_versions WHERE article_id = ? ORDER BY version ASC'
    ).bind(articleObj.id).all();

    const versions = versionsResult.results.map(row =>
      mapDbRowToArticleVersion(row as Record<string, unknown>)
    );

    // Get comments for latest version
    const latestVersion = versions.length > 0 ? versions[versions.length - 1].version : 0;
    const commentsResult = await c.env.DB.prepare(
      'SELECT * FROM article_comments WHERE article_id = ? AND version = ? ORDER BY likes DESC'
    ).bind(articleObj.id, latestVersion).all();

    const comments = commentsResult.results.map(row =>
      mapDbRowToArticleComment(row as Record<string, unknown>)
    );

    return successResponse({ article: articleObj, versions, comments });
  });
});

// GET /api/articles/:id/version/:version - Get specific version
articleRoutes.get('/:id/version/:version', async (c) => {
  const reqId = generateRequestId();
  const id = c.req.param('id');
  const versionNum = parseInt(c.req.param('version'), 10);
  return runRoute(log.articleRoutes, reqId, {
    method: 'GET',
    path: '/:id/version/:version',
    id,
    version: versionNum
  }, async () => {
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
      return notFoundResponse('Article');
    }

    const articleObj = mapDbRowToArticle(article);

    // Get specific version
    const version = await c.env.DB.prepare(
      'SELECT * FROM article_versions WHERE article_id = ? AND version = ?'
    ).bind(articleObj.id, versionNum).first();

    if (!version) {
      log.articleRoutes.warn(reqId, 'Version not found', { id, version: versionNum });
      return notFoundResponse('Article version');
    }

    const versionObj = mapDbRowToArticleVersion(version as Record<string, unknown>);

    // Get comments for this version
    const commentsResult = await c.env.DB.prepare(
      'SELECT * FROM article_comments WHERE article_id = ? AND version = ? ORDER BY likes DESC'
    ).bind(articleObj.id, versionNum).all();

    const comments = commentsResult.results.map(row =>
      mapDbRowToArticleComment(row as Record<string, unknown>)
    );

    return successResponse({ article: articleObj, version: versionObj, comments });
  });
});

// POST /api/articles/trigger/:pickId - Manual trigger
articleRoutes.post('/trigger/:pickId', async (c) => {
  const reqId = generateRequestId();
  const pickId = c.req.param('pickId');
  return runRoute(log.articleRoutes, reqId, { method: 'POST', path: `/trigger/${pickId}` }, async () => {
    const body = await c.req.json<{ isRescrape?: boolean }>().catch(() => ({ isRescrape: false }));

    const params: ArticleScraperParams = {
      pickId,
      isRescrape: body.isRescrape ?? false
    };

    // Create workflow instance
    const instance = await c.env.ARTICLE_SCRAPER_WORKFLOW.create({
      params
    });

    log.articleRoutes.info(reqId, 'Workflow created', { workflowId: instance.id, pickId });
    return successResponse({ workflowId: instance.id, pickId });
  });
});

// GET /api/articles/status/:workflowId - Workflow status
articleRoutes.get('/status/:workflowId', async (c) => {
  const reqId = generateRequestId();
  const workflowId = c.req.param('workflowId');
  return runRoute(log.articleRoutes, reqId, { method: 'GET', path: `/status/${workflowId}` }, async () => {
    const instance = await c.env.ARTICLE_SCRAPER_WORKFLOW.get(workflowId);

    if (!instance) {
      log.articleRoutes.warn(reqId, 'Workflow not found', { workflowId });
      return notFoundResponse('Workflow');
    }

    const status = await instance.status();

    return successResponse({
      workflowId: instance.id,
      status: status.status,
      output: status.output as ArticleScraperResult | undefined
    });
  });
});

export { articleRoutes };
