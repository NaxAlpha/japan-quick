/**
 * Type definitions for Japan Quick video rendering
 */

export interface SlideInput {
  imageUrl: string;          // Public R2 URL for slide image
  audioUrl: string;          // Public R2 URL for slide audio
  headline?: string;         // Optional headline overlay
  durationInFrames: number;  // Duration in frames at 30 FPS
}

export interface VideoInputProps {
  slides: SlideInput[];
  videoType: 'short' | 'long';
  articleDate: string;       // ISO date string or Yahoo format
}

export type ZoomDirection = 'in' | 'out';
