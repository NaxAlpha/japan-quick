-- Migration for video rendering feature
-- Adds render status tracking to videos table

ALTER TABLE videos ADD COLUMN render_status TEXT DEFAULT 'pending';
ALTER TABLE videos ADD COLUMN render_error TEXT;
ALTER TABLE videos ADD COLUMN render_started_at TEXT;
ALTER TABLE videos ADD COLUMN render_completed_at TEXT;

CREATE INDEX idx_videos_render_status ON videos(render_status);
