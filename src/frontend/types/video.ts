// Frontend video types
// These are duplicated from ../../types/video.ts to satisfy TypeScript rootDir constraints

export type VideoType = 'short' | 'long';
export type VideoSelectionStatus = 'todo' | 'doing' | 'done' | 'error';
export type ScriptStatus = 'pending' | 'generating' | 'generated' | 'error';
export type AssetStatus = 'pending' | 'generating' | 'generated' | 'error';
export type RenderStatus = 'pending' | 'rendering' | 'rendered' | 'error';
export type YouTubeUploadStatus = 'pending' | 'uploading' | 'processing' | 'uploaded' | 'error';

// Model ID types
export type ImageModelId = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';
export type TTSModelId = 'gemini-2.5-flash-preview-tts' | 'gemini-2.5-pro-preview-tts';

// Image size types
export type ImageSize = '1K' | '2K' | '4K';

// TTS voice type (30 voices)
export type TTSVoice = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Leda' |
  'Enceladus' | 'Aoede' | 'Autonoe' | 'Laomedeia' | 'Iapetus' | 'Erinome' |
  'Alnilam' | 'Algieba' | 'Despina' | 'Umbriel' | 'Callirrhoe' | 'Achernar' |
  'Sulafat' | 'Vindemiatrix' | 'Achird' | 'Orus' | 'Algenib' | 'Rasalgethi' |
  'Gacrux' | 'Pulcherrima' | 'Zubenelgenubi' | 'Sadachbia' | 'Sadaltager';

// Script-related interfaces
export interface Slide {
  headline: string;
  imageDescription: string;
  audioNarration: string;
  estimatedDuration: number;
}

export interface VideoScript {
  title: string;
  description: string;
  thumbnailDescription: string;
  slides: Slide[];
}

// Asset metadata interfaces
export interface GridImageMetadata {
  gridIndex: number;
  aspectRatio: '9:16' | '16:9';
  width: number;                  // 768, 1536, 3072 (9:16) or 1376, 2752, 5504 (16:9)
  height: number;                 // 1376, 2752, 5504 (9:16) or 768, 1536, 3072 (16:9)
  cellWidth: number;              // 256, 512, 1024 (9:16) or 459, 917, 1835 (16:9)
  cellHeight: number;             // 459, 917, 1835 (9:16) or 256, 512, 1024 (16:9)
  positions: Array<{
    cell: number;
    slideIndex: number | null;
    isThumbnail: boolean;
    isEmpty: boolean;
    cropRect: { x: number; y: number; w: number; h: number };
  }>;
}

export interface ImageGenerationPromptMetadata {
  gridIndex: number;              // 0 or 1
  model: ImageModelId;            // Store which model was used
  resolution: ImageSize;          // Store resolution used
}

export interface SlideAudioMetadata {
  slideIndex: number;
  voiceName: string;
  durationMs: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

// Script prompt interface
export interface ScriptPrompt {
  id: number;
  video_id: number;
  prompt: string;
  r2_key: string;
  public_url: string;
  created_at: string;
}

// YouTube info interface (from youtube_info table)
export interface YouTubeInfo {
  id: number;
  video_id: number;
  youtube_video_id: string;
  youtube_video_url: string;
  title: string | null;
  description: string | null;
  privacy_status: string;
  tags: string | null;            // JSON array string
  category_id: string;
  made_for_kids: number;          // 0 or 1
  self_declared_made_for_kids: number;  // 0 or 1
  contains_synthetic_media: number;     // 0 or 1
  not_paid_content: number;       // 0 or 1
  upload_started_at: string | null;
  upload_completed_at: string | null;
  created_at: string;
  updated_at: string;
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

// Parsed asset for frontend (with URL)
export interface ParsedVideoAsset {
  id: number;
  assetType: 'grid_image' | 'slide_image' | 'slide_audio' | 'rendered_video' | 'selection_prompt' | 'script_prompt' | 'image_generation_prompt';
  assetIndex: number;
  url: string;
  mimeType: string;
  fileSize: number | null;
  metadata: GridImageMetadata | SlideAudioMetadata | RenderedVideoMetadata | null;
  publicUrl: string | null;
  generationType: string;
}

// Frontend-ready interface
export interface ParsedVideo {
  id: number;
  notes: string[];
  short_title: string | null;
  articles: string[];
  video_type: VideoType;
  selection_status: VideoSelectionStatus;
  total_cost: number;
  script: VideoScript | null;
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
  slideImageAssetIds: string[];
  slideAudioAssetIds: string[];
  assets: ParsedVideoAsset[];
  renderedVideo: ParsedVideoAsset | null;
  scriptPrompt: ScriptPrompt | null;
  youtube_upload_status: YouTubeUploadStatus;
  youtube_upload_error: string | null;
  youtubeInfo?: YouTubeInfo;
  created_at: string;
  updated_at: string;
}
