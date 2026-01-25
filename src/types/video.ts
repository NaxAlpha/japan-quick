// Video type definitions

export type VideoType = 'short' | 'long';
export type VideoSelectionStatus = 'todo' | 'doing' | 'done' | 'error';
export type ScriptStatus = 'pending' | 'generating' | 'generated' | 'error';

// Script-related interfaces
export interface Slide {
  headline: string;           // Short title
  imageDescription: string;   // Image prompt (always English)
  audioNarration: string;     // Narration (article language)
  estimatedDuration: number;  // 10-20 seconds
}

export interface VideoScript {
  title: string;              // SEO YouTube title
  description: string;        // SEO description
  thumbnailDescription: string; // Compelling thumbnail image prompt
  slides: Slide[];
}

// Database record interface (notes as string, total_cost field)
export interface Video {
  id: number;
  notes: string | null;              // Newline-joined rationale strings
  short_title: string | null;        // English title for video
  articles: string | null;           // JSON array of pick_id values
  video_type: VideoType;
  selection_status: VideoSelectionStatus;
  total_cost: number;
  script: string | null;             // JSON-serialized VideoScript
  script_status: ScriptStatus;
  script_error: string | null;
  created_at: string;
  updated_at: string;
}

// Frontend-ready interface (notes split by newline to array, articles parsed from JSON)
export interface ParsedVideo extends Omit<Video, 'notes' | 'articles' | 'script'> {
  notes: string[];                   // Split by newline
  articles: string[];                // Parsed from JSON
  script: VideoScript | null;        // Parsed from JSON
}

// Model info interface
export interface Model {
  id: string;                        // e.g., "gemini-3-flash-preview"
  name: string;                      // e.g., "Gemini 3 Flash"
  description: string | null;        // Model description
  input_cost_per_million: number;    // Cost per 1M input tokens
  output_cost_per_million: number;   // Cost per 1M output tokens
  created_at: string;
}

// Cost log interface
export interface CostLog {
  id: number;
  video_id: number;
  log_type: string;                  // e.g., "video-selection", "script-generation"
  model_id: string;                  // FK to models.id
  attempt_id: number;                // Attempt number for retries
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number;                      // Calculated cost for this operation
  created_at: string;
}

// AI article input format
export interface AIArticleInput {
  index: string;                     // 4-digit index for AI prompt
  title: string;
  dateTime: string;
  source: string;
}

// AI selection output format
export interface AISelectionOutput {
  notes: string[];                   // Array of selection rationale
  short_title: string;               // English title for video
  articles: string[];                // Array of 4-digit indices from AI
  video_type: VideoType;             // "short" | "long"
}

// Helper function to parse video from DB to frontend format
export function parseVideo(video: Video): ParsedVideo {
  return {
    ...video,
    notes: video.notes ? video.notes.split('\n') : [],
    articles: video.articles ? JSON.parse(video.articles) : [],
    script: video.script ? JSON.parse(video.script) : null
  };
}
