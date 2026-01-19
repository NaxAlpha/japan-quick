/**
 * Reusable HTML template generator for frontend pages
 * This avoids duplicating HTML boilerplate for each route
 */

export interface PageTemplateOptions {
  title: string;
  description: string;
  componentName: string; // e.g., 'app-root', 'news-page'
  scriptPath: string;    // e.g., '/frontend/app.js', '/frontend/pages/news-page.js'
}

/**
 * Generates a reusable HTML shell for frontend pages.
 * This avoids duplicating HTML boilerplate for each route.
 */
export function renderPageTemplate(options: PageTemplateOptions): string {
  const { title, description, componentName, scriptPath } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${description}">
    <title>${title}</title>
    <link rel="stylesheet" href="/styles.css">
    <script type="importmap">
    {
        "imports": {
            "lit": "https://esm.sh/lit@3.2.0",
            "lit/decorators.js": "https://esm.sh/lit@3.2.0/decorators.js",
            "lit/directives/": "https://esm.sh/lit@3.2.0/directives/",
            "lit/": "https://esm.sh/lit@3.2.0/"
        }
    }
    </script>
</head>
<body>
    <${componentName}></${componentName}>
    <script type="module" src="${scriptPath}"></script>
</body>
</html>`;
}
