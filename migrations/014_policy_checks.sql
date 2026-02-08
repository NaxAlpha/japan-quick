-- Policy checks and status tracking

ALTER TABLE videos ADD COLUMN script_policy_status TEXT DEFAULT 'PENDING';
ALTER TABLE videos ADD COLUMN asset_policy_status TEXT DEFAULT 'PENDING';
ALTER TABLE videos ADD COLUMN policy_overall_status TEXT DEFAULT 'PENDING';
ALTER TABLE videos ADD COLUMN policy_summary TEXT;
ALTER TABLE videos ADD COLUMN policy_block_reasons TEXT;
ALTER TABLE videos ADD COLUMN policy_last_checked_at TEXT;

CREATE TABLE policy_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  stage TEXT NOT NULL,                -- script_light | asset_strong
  model_id TEXT NOT NULL,
  status TEXT NOT NULL,               -- CLEAN | WARN | REVIEW | BLOCK
  summary TEXT,
  prompt_r2_key TEXT,
  response_r2_key TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (model_id) REFERENCES models(id)
);

CREATE TABLE policy_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_run_id INTEGER NOT NULL,
  check_code TEXT NOT NULL,
  check_label TEXT NOT NULL,
  status TEXT NOT NULL,               -- PASS | WARN | REVIEW | BLOCK
  reason TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (policy_run_id) REFERENCES policy_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_videos_script_policy_status ON videos(script_policy_status);
CREATE INDEX idx_videos_asset_policy_status ON videos(asset_policy_status);
CREATE INDEX idx_videos_policy_overall_status ON videos(policy_overall_status);
CREATE INDEX idx_policy_runs_video_stage ON policy_runs(video_id, stage, created_at DESC);
CREATE INDEX idx_policy_runs_status ON policy_runs(status);
CREATE INDEX idx_policy_findings_run_id ON policy_findings(policy_run_id);
CREATE INDEX idx_policy_findings_status ON policy_findings(status);

INSERT OR IGNORE INTO models (id, name, description, input_cost_per_million, output_cost_per_million)
VALUES ('gemini-3-flash-preview', 'Gemini 3 Flash', 'Google Gemini 3 Flash - fast frontier model', 0.50, 3.00);

INSERT OR IGNORE INTO models (id, name, description, input_cost_per_million, output_cost_per_million)
VALUES ('gemini-3-pro-preview', 'Gemini 3 Pro', 'Google Gemini 3 Pro - high quality model', 2.00, 12.00);
