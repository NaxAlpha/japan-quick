-- Migration for script prompts storage
-- Create dedicated table for storing script generation prompts

CREATE TABLE IF NOT EXISTS script_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_script_prompts_video_id ON script_prompts(video_id);
