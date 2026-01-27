// Frontend video types
// These are duplicated from ../../types/video.ts to satisfy TypeScript rootDir constraints

export type VideoType = 'short' | 'long';
export type VideoSelectionStatus = 'todo' | 'doing' | 'done' | 'error';
export type ScriptStatus = 'pending' | 'generating' | 'generated' | 'error';
export type AssetStatus = 'pending' | 'generating' | 'generated' | 'error';
export type RenderStatus = 'pending' | 'rendering' | 'rendered' | 'error';

// Model ID types
export type ImageModelId = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';
export type TTSModelId = 'gemini-2.5-flash-preview-tts' | 'gemini-2.5-pro-preview-tts';

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
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
  positions: Array<{
    cell: number;
    slideIndex: number | null;
    isThumbnail: boolean;
    isEmpty: boolean;
    cropRect: { x: number; y: number; w: number; h: number };
  }>;
}

export interface SlideAudioMetadata {
  slideIndex: number;
  voiceName: string;
  durationMs: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
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
  assetType: 'grid_image' | 'slide_audio' | 'rendered_video';
  assetIndex: number;
  url: string;
  mimeType: string;
  fileSize: number | null;
  metadata: GridImageMetadata | SlideAudioMetadata | RenderedVideoMetadata | null;
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
  assets: ParsedVideoAsset[];
  renderedVideo: ParsedVideoAsset | null;
  created_at: string;
  updated_at: string;
}
