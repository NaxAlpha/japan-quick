-- Add image generation models
INSERT INTO models (id, name, description, input_cost_per_million, output_cost_per_million) VALUES
  ('gemini-2.5-flash-image', 'Gemini 2.5 Flash Image', 'Fast image generation', 0.0, 39.0),
  ('gemini-3-pro-image-preview', 'Gemini 3 Pro Image', 'High-quality image generation', 0.0, 134.0);

-- Add TTS models
INSERT INTO models (id, name, description, input_cost_per_million, output_cost_per_million) VALUES
  ('gemini-2.5-flash-preview-tts', 'Gemini 2.5 Flash TTS', 'Fast TTS', 0.5, 10.0),
  ('gemini-2.5-pro-preview-tts', 'Gemini 2.5 Pro TTS', 'High-quality TTS', 1.0, 20.0);

-- Video assets storage
CREATE TABLE video_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  asset_type TEXT NOT NULL,           -- 'grid_image' | 'slide_audio'
  asset_index INTEGER DEFAULT 0,       -- 0/1 for grids, 0-17 for audio
  r2_key TEXT NOT NULL,               -- R2 object path
  mime_type TEXT NOT NULL,            -- 'image/png' | 'audio/wav'
  file_size INTEGER,                  -- bytes
  metadata TEXT,                      -- JSON with position/duration info
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE INDEX idx_video_assets_video_id ON video_assets(video_id);
CREATE INDEX idx_video_assets_type ON video_assets(asset_type, asset_index);

-- Add asset columns to videos
ALTER TABLE videos ADD COLUMN asset_status TEXT DEFAULT 'pending';
ALTER TABLE videos ADD COLUMN asset_error TEXT;
ALTER TABLE videos ADD COLUMN image_model TEXT DEFAULT 'gemini-2.5-flash-image';
ALTER TABLE videos ADD COLUMN tts_model TEXT DEFAULT 'gemini-2.5-flash-preview-tts';
ALTER TABLE videos ADD COLUMN tts_voice TEXT;  -- Random voice, stored for consistency

CREATE INDEX idx_videos_asset_status ON videos(asset_status);
