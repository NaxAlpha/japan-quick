-- Add script generation columns to videos table
ALTER TABLE videos ADD COLUMN script TEXT;
ALTER TABLE videos ADD COLUMN script_status TEXT DEFAULT 'pending';
ALTER TABLE videos ADD COLUMN script_error TEXT;

-- Add index for efficient filtering by script status
CREATE INDEX idx_videos_script_status ON videos(script_status);
