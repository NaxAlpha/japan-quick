/**
 * Unit tests for HTML template
 */

import { describe, it, expect } from 'vitest';
import { renderPageTemplate } from '../../../lib/html-template.js';

describe('HTML Template', () => {
  it('should generate valid HTML with all required elements', () => {
    const html = renderPageTemplate({
      title: 'Test Page',
      description: 'Test Description',
      componentName: 'test-component',
      scriptPath: '/frontend/test.js'
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test Page</title>');
    expect(html).toContain('Test Description');
    expect(html).toContain('<test-component>');
    expect(html).toContain('/frontend/test.js');
  });

  it('should include import map for Lit', () => {
    const html = renderPageTemplate({
      title: 'Test',
      description: 'Test',
      componentName: 'test',
      scriptPath: '/test.js'
    });

    expect(html).toContain('<script type="importmap">');
    expect(html).toContain('lit@3.2.0');
  });

  it('should escape HTML in title and description', () => {
    const html = renderPageTemplate({
      title: '<script>alert("xss")</script>',
      description: '">desc',
      componentName: 'test',
      scriptPath: '/test.js'
    });

    // Should still be valid HTML
    expect(html).toMatch(/^<!DOCTYPE html>/);
  });

  it('should include proper meta tags', () => {
    const html = renderPageTemplate({
      title: 'Test',
      description: 'Test Description',
      componentName: 'test',
      scriptPath: '/test.js'
    });

    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('viewport');
  });
});
