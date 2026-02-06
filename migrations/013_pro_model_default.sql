-- Change default image model to pro model for future videos
-- This migration recreates the videos table with the updated default value
-- Existing videos keep their current model, only NEW videos will use pro model as default

-- Step 1: Disable foreign key constraints temporarily
PRAGMA foreign_keys = OFF;

-- Step 2: Create a new videos table with updated default
CREATE TABLE IF NOT EXISTS videos_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notes TEXT,
  short_title TEXT,
  articles TEXT,
  video_type TEXT NOT NULL,
  selection_status TEXT NOT NULL DEFAULT 'todo',
  total_cost REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  script TEXT,
  script_status TEXT DEFAULT 'pending',
  script_error TEXT,
  asset_status TEXT DEFAULT 'pending',
  asset_error TEXT,
  image_model TEXT DEFAULT 'gemini-3-pro-image-preview',
  tts_model TEXT DEFAULT 'gemini-2.5-flash-preview-tts',
  tts_voice TEXT,
  render_status TEXT DEFAULT 'pending',
  render_error TEXT,
  render_started_at TEXT,
  render_completed_at TEXT,
  slide_image_asset_ids TEXT,
  slide_audio_asset_ids TEXT,
  video_format TEXT DEFAULT 'single_short',
  urgency TEXT DEFAULT 'regular',
  youtube_upload_status TEXT DEFAULT 'pending',
  youtube_upload_error TEXT
);

-- Step 3: Copy existing data to new table
INSERT INTO videos_new (
  id, notes, short_title, articles, video_type, selection_status, total_cost,
  created_at, updated_at, script, script_status, script_error, asset_status, asset_error,
  image_model, tts_model, tts_voice, render_status, render_error, render_started_at,
  render_completed_at, slide_image_asset_ids, slide_audio_asset_ids, video_format,
  urgency, youtube_upload_status, youtube_upload_error
)
SELECT
  id, notes, short_title, articles, video_type, selection_status, total_cost,
  created_at, updated_at, script, script_status, script_error, asset_status, asset_error,
  image_model, tts_model, tts_voice, render_status, render_error, render_started_at,
  render_completed_at, slide_image_asset_ids, slide_audio_asset_ids, video_format,
  urgency, youtube_upload_status, youtube_upload_error
FROM videos;

-- Step 4: Drop old table and rename new table
DROP TABLE videos;
ALTER TABLE videos_new RENAME TO videos;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
CREATE INDEX IF NOT EXISTS idx_videos_script_status ON videos(script_status);
CREATE INDEX IF NOT EXISTS idx_videos_asset_status ON videos(asset_status);
CREATE INDEX IF NOT EXISTS idx_videos_render_status ON videos(render_status);
CREATE INDEX IF NOT EXISTS idx_videos_youtube_upload_status ON videos(youtube_upload_status);

-- Step 6: Re-enable foreign key constraints
PRAGMA foreign_keys = ON;
