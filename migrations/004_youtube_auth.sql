-- YouTube OAuth 2.0 Authentication Table
-- Stores access tokens and refresh tokens for YouTube API integration

CREATE TABLE IF NOT EXISTS youtube_auth (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL UNIQUE,
  channel_title TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  scopes TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_youtube_auth_channel_id ON youtube_auth(channel_id);
CREATE INDEX IF NOT EXISTS idx_youtube_auth_expires_at ON youtube_auth(expires_at);
