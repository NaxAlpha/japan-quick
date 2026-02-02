-- Migration for video selection v2
-- Adds video format and urgency columns

ALTER TABLE videos ADD COLUMN video_format TEXT DEFAULT 'single_short';
ALTER TABLE videos ADD COLUMN urgency TEXT DEFAULT 'regular';
