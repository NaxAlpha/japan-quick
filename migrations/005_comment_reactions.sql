-- Add reaction breakdown columns for Yahoo News comment reactions
ALTER TABLE article_comments ADD COLUMN reactions_empathized INTEGER DEFAULT 0;
ALTER TABLE article_comments ADD COLUMN reactions_understood INTEGER DEFAULT 0;
ALTER TABLE article_comments ADD COLUMN reactions_questioning INTEGER DEFAULT 0;

-- Add replies JSON column for nested replies storage
ALTER TABLE article_comments ADD COLUMN replies TEXT;

-- Migrate existing data: reactions_empathized = likes (for backwards compatibility)
UPDATE article_comments SET reactions_empathized = likes WHERE likes > 0;
