-- Add YouTube upload status to videos table
ALTER TABLE videos ADD COLUMN youtube_upload_status TEXT DEFAULT 'pending';
ALTER TABLE videos ADD COLUMN youtube_upload_error TEXT;

-- Create youtube_info table for YouTube video metadata
CREATE TABLE youtube_info (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL UNIQUE,
  youtube_video_id TEXT NOT NULL,
  youtube_video_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  privacy_status TEXT DEFAULT 'public',
  tags TEXT,
  category_id TEXT DEFAULT '25',
  made_for_kids INTEGER DEFAULT 0,
  self_declared_made_for_kids INTEGER DEFAULT 0,
  contains_synthetic_media INTEGER DEFAULT 1,
  not_paid_content INTEGER DEFAULT 1,
  upload_started_at TEXT,
  upload_completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE INDEX idx_youtube_info_video_id ON youtube_info(video_id);
CREATE INDEX idx_youtube_info_youtube_video_id ON youtube_info(youtube_video_id);
