/**
 * Frontend page routes
 * Serves HTML pages for the application
 */

import { Hono } from 'hono';
import { renderPageTemplate, renderPageTemplateWithProps } from '../lib/html-template.js';

const frontendRoutes = new Hono();

// Home page - uses existing app-root component
frontendRoutes.get('/', (c) => {
  const html = renderPageTemplate({
    title: 'Japan Quick',
    description: 'AI-powered video generation for YouTube Shorts & Long-form',
    componentName: 'app-root',
    scriptPath: '/frontend/app.js'
  });
  return c.html(html);
});

// News page - uses news-page component
frontendRoutes.get('/news', (c) => {
  const html = renderPageTemplate({
    title: 'Yahoo News Japan - Japan Quick',
    description: 'Yahoo News Japan Top Picks',
    componentName: 'news-page',
    scriptPath: '/frontend/pages/news-page.js'
  });
  return c.html(html);
});

// Article page - uses article-page component with article ID parameter
frontendRoutes.get('/article/:id', (c) => {
  const articleId = c.req.param('id');
  const html = renderPageTemplateWithProps({
    title: 'Article - Japan Quick',
    description: 'Yahoo News Japan Article',
    componentName: 'article-page',
    scriptPath: '/frontend/pages/article-page.js',
    props: { articleId }
  });
  return c.html(html);
});

export { frontendRoutes };
