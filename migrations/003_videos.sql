-- Models table: stores AI model info for cost tracking and future model additions
CREATE TABLE models (
  id TEXT PRIMARY KEY,                    -- e.g., "gemini-3-flash-preview"
  name TEXT NOT NULL,                     -- e.g., "Gemini 3 Flash"
  description TEXT,                       -- Model description
  input_cost_per_million REAL NOT NULL,   -- Cost per 1M input tokens (e.g., 0.50)
  output_cost_per_million REAL NOT NULL,  -- Cost per 1M output tokens (e.g., 3.00)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert Gemini 3 Flash model info
INSERT INTO models (id, name, description, input_cost_per_million, output_cost_per_million)
VALUES ('gemini-3-flash-preview', 'Gemini 3 Flash', 'Google Gemini 3 Flash - fast frontier model', 0.50, 3.00);

-- Videos table: stores video selections
CREATE TABLE videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notes TEXT,                    -- Newline-joined selection rationale strings
  short_title TEXT,              -- English title for video
  articles TEXT,                 -- JSON array of pick_id values
  video_type TEXT NOT NULL,      -- "short" | "long"
  selection_status TEXT NOT NULL DEFAULT 'todo',  -- "todo" | "doing" | "done"
  total_cost REAL DEFAULT 0,     -- Sum of all cost_logs for this video
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cost logs table: tracks AI costs per operation
CREATE TABLE cost_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  log_type TEXT NOT NULL,        -- e.g., "video-selection", "script-generation"
  model_id TEXT NOT NULL,        -- FK to models.id
  attempt_id INTEGER DEFAULT 1,  -- Attempt number for retries
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost REAL NOT NULL,            -- Calculated cost for this operation
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (video_id) REFERENCES videos(id),
  FOREIGN KEY (model_id) REFERENCES models(id)
);

CREATE INDEX idx_videos_selection_status ON videos(selection_status);
CREATE INDEX idx_videos_created_at ON videos(created_at);
CREATE INDEX idx_cost_logs_video_id ON cost_logs(video_id);
CREATE INDEX idx_cost_logs_log_type ON cost_logs(log_type);
