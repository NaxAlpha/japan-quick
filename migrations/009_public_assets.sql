-- Migration for public asset system
-- Adds ULID-based asset storage with public URLs and slide image extraction

-- Add slide asset mapping columns to videos table
ALTER TABLE videos ADD COLUMN slide_image_asset_ids TEXT;  -- JSON array of asset IDs
ALTER TABLE videos ADD COLUMN slide_audio_asset_ids TEXT;  -- JSON array of asset IDs

-- Add public URL and generation type columns to video_assets
ALTER TABLE video_assets ADD COLUMN public_url TEXT;
ALTER TABLE video_assets ADD COLUMN generation_type TEXT DEFAULT 'grid';

-- Create index for public URL lookups
CREATE INDEX idx_video_assets_public_url ON video_assets(public_url);

-- Reset existing asset and render status (force regeneration with new format)
UPDATE videos SET asset_status = 'pending' WHERE asset_status = 'generated';
UPDATE videos SET render_status = 'pending' WHERE render_status = 'rendered';
