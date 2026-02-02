// Video type definitions

export type VideoType = 'short' | 'long';
export type VideoFormat = 'single_short' | 'multi_short' | 'long';
export type UrgencyLevel = 'urgent' | 'developing' | 'regular';
export type VideoSelectionStatus = 'todo' | 'doing' | 'done' | 'error';
export type ScriptStatus = 'pending' | 'generating' | 'generated' | 'error';
export type AssetStatus = 'pending' | 'generating' | 'generated' | 'error';
export type RenderStatus = 'pending' | 'rendering' | 'rendered' | 'error';

// Model ID types
export type ImageModelId = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';
export type TTSModelId = 'gemini-2.5-flash-preview-tts' | 'gemini-2.5-pro-preview-tts';

// Image size types
export type ImageSize = '1K' | '2K';

// TTS voice type (30 voices)
export type TTSVoice = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Leda' |
  'Enceladus' | 'Aoede' | 'Autonoe' | 'Laomedeia' | 'Iapetus' | 'Erinome' |
  'Alnilam' | 'Algieba' | 'Despina' | 'Umbriel' | 'Callirrhoe' | 'Achernar' |
  'Sulafat' | 'Vindemiatrix' | 'Achird' | 'Orus' | 'Algenib' | 'Rasalgethi' |
  'Gacrux' | 'Pulcherrima' | 'Zubenelgenubi' | 'Sadachbia' | 'Sadaltager';

// TTS voices array for runtime
export const TTS_VOICES: readonly TTSVoice[] = [
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Enceladus', 'Aoede',
  'Autonoe', 'Laomedeia', 'Iapetus', 'Erinome', 'Alnilam', 'Algieba', 'Despina',
  'Umbriel', 'Callirrhoe', 'Achernar', 'Sulafat', 'Vindemiatrix', 'Achird',
  'Orus', 'Algenib', 'Rasalgethi', 'Gacrux', 'Pulcherrima', 'Zubenelgenubi',
  'Sadachbia', 'Sadaltager'
] as const;

// Dimension-related interfaces
export interface ImageDimensions {
  gridSize: string;
  cellSize: string;
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
}

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

// Asset metadata interfaces
export interface GridImageMetadata {
  gridIndex: number;              // 0 or 1
  aspectRatio: '9:16' | '16:9';
  width: number;                  // 1080 or 1920
  height: number;                 // 1920 or 1080
  cellWidth: number;              // 360 or 640
  cellHeight: number;             // 640 or 360
  positions: Array<{
    cell: number;                 // 0-8
    slideIndex: number | null;    // null for thumbnail or empty
    isThumbnail: boolean;
    isEmpty: boolean;
    cropRect: { x: number; y: number; w: number; h: number };
  }>;
}

export interface SlideAudioMetadata {
  slideIndex: number;
  voiceName: string;
  durationMs: number;
  sampleRate: number;             // 24000
  channels: number;               // 1
  bitDepth: number;               // 16
}

export interface RenderedVideoMetadata {
  width: number;
  height: number;
  durationMs: number;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  format: string;
}

// Video asset interfaces
export interface VideoAsset {
  id: number;
  video_id: number;
  asset_type: 'grid_image' | 'slide_image' | 'slide_audio' | 'rendered_video' | 'selection_prompt';
  asset_index: number;
  r2_key: string;
  mime_type: string;
  file_size: number | null;
  metadata: string | null;
  public_url: string | null;        // Public URL for direct access
  generation_type: string;          // 'grid' | 'individual'
  created_at: string;
}

// Parsed asset for frontend (with URL)
export interface ParsedVideoAsset {
  id: number;
  assetType: 'grid_image' | 'slide_image' | 'slide_audio' | 'rendered_video' | 'selection_prompt';
  assetIndex: number;
  url: string;                    // Public URL or API route
  mimeType: string;
  fileSize: number | null;
  metadata: GridImageMetadata | SlideAudioMetadata | RenderedVideoMetadata | null;
  publicUrl: string | null;       // Direct public URL
  generationType: string;         // 'grid' | 'individual'
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
  asset_status: AssetStatus;
  asset_error: string | null;
  image_model: ImageModelId;
  tts_model: TTSModelId;
  tts_voice: TTSVoice | null;
  render_status: RenderStatus;
  render_error: string | null;
  render_started_at: string | null;
  render_completed_at: string | null;
  slide_image_asset_ids: string | null;   // JSON array of ULID asset IDs
  slide_audio_asset_ids: string | null;   // JSON array of ULID asset IDs
  created_at: string;
  updated_at: string;
}

// Frontend-ready interface (notes split by newline to array, articles parsed from JSON)
export interface ParsedVideo extends Omit<Video, 'notes' | 'articles' | 'script' | 'slide_image_asset_ids' | 'slide_audio_asset_ids'> {
  notes: string[];                   // Split by newline
  articles: string[];                // Parsed from JSON
  script: VideoScript | null;        // Parsed from JSON
  assets: ParsedVideoAsset[];        // Video assets with URLs
  renderedVideo: ParsedVideoAsset | null;  // Rendered video asset if present
  slideImageAssetIds: string[];      // Parsed slide image asset ULIDs
  slideAudioAssetIds: string[];      // Parsed slide audio asset ULIDs
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

// AI article input with content
export interface AIArticleInputWithContent extends AIArticleInput {
  content: string;
  contentLength: number;
  status: string;
}

// Past video context for AI selection
export interface PastVideoContext {
  id: number;
  title: string;
  articles: string[];                // Array of article titles
  videoType: string;
  videoFormat: string;
  createdAt: string;
}

// AI selection output format
export interface AISelectionOutput {
  notes: string[];                   // Array of selection rationale
  short_title: string;               // English title for video
  articles: string[];                // Array of 4-digit indices from AI
  video_type: VideoType;             // "short" | "long"
}

// Enhanced AI selection output format
export interface EnhancedAISelectionOutput extends AISelectionOutput {
  video_format: VideoFormat;         // "single_short" | "multi_short" | "long"
  urgency: UrgencyLevel;             // "urgent" | "developing" | "regular"
  skip_for_multi_story?: string[];   // Optional array of article indices to skip for multi-story videos
}

// Helper function to parse video from DB to frontend format
export function parseVideo(video: Video): ParsedVideo {
  return {
    ...video,
    notes: video.notes ? video.notes.split('\n') : [],
    articles: video.articles ? JSON.parse(video.articles) : [],
    script: video.script ? JSON.parse(video.script) : null,
    slideImageAssetIds: video.slide_image_asset_ids ? JSON.parse(video.slide_image_asset_ids) : [],
    slideAudioAssetIds: video.slide_audio_asset_ids ? JSON.parse(video.slide_audio_asset_ids) : [],
    assets: [], // Assets are populated separately in the route handler
    renderedVideo: null // Rendered video is populated separately in the route handler
  };
}
