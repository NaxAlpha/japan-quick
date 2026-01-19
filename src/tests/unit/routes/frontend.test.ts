/**
 * Unit tests for frontend routes
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { frontendRoutes } from '../../../routes/frontend.js';

describe('Frontend Routes', () => {
  it('should return HTML for /news route', async () => {
    const app = new Hono();
    app.route('/', frontendRoutes);

    const response = await app.request('/news');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');

    const html = await response.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Yahoo News Japan');
    expect(html).toContain('<news-page>');
    expect(html).toContain('/frontend/pages/news-page.js');
  });

  it('should include proper meta tags', async () => {
    const app = new Hono();
    app.route('/', frontendRoutes);

    const response = await app.request('/news');
    const html = await response.text();

    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('viewport');
    expect(html).toContain('Yahoo News Japan - Top Picks');
  });

  it('should return HTML for / route', async () => {
    const app = new Hono();
    app.route('/', frontendRoutes);

    const response = await app.request('/');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');

    const html = await response.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Japan Quick');
    expect(html).toContain('<app-root>');
    expect(html).toContain('/frontend/app.js');
  });
});
