-- Article scraper database schema
-- Tables for storing scraped article content, versions, and comments

CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pick_id TEXT NOT NULL UNIQUE,
  article_id TEXT,
  article_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, not_available, scraped_v1, scraped_v2
  title TEXT,
  source TEXT,
  thumbnail_url TEXT,
  published_at TEXT,
  modified_at TEXT,
  detected_at TEXT NOT NULL,
  first_scraped_at TEXT,
  second_scraped_at TEXT,
  scheduled_rescrape_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE article_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_text TEXT,
  page_count INTEGER DEFAULT 1,
  images TEXT,
  scraped_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES articles(id),
  UNIQUE(article_id, version)
);

CREATE TABLE article_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  comment_id TEXT,
  author TEXT,
  content TEXT NOT NULL,
  posted_at TEXT,
  likes INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  scraped_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES articles(id)
);

CREATE INDEX idx_articles_pick_id ON articles(pick_id);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_scheduled_rescrape ON articles(scheduled_rescrape_at);
CREATE INDEX idx_article_versions_article_id ON article_versions(article_id);
CREATE INDEX idx_article_comments_article_id ON article_comments(article_id);
