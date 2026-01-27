/**
 * Dimension Utility - Centralized dimension calculations for asset generation
 * Provides consistent dimension calculations for 1K and 2K resolutions
 */

import type { ImageSize, ImageDimensions, ImageModelId } from '../types/video.js';

/**
 * Calculate grid dimensions based on video type and image size
 */
export function calculateGridDimensions(
  videoType: 'short' | 'long',
  imageSize: ImageSize
): ImageDimensions {
  const isShort = videoType === 'short';

  if (imageSize === '2K') {
    if (isShort) {
      return {
        gridSize: '2048x3658',
        cellSize: '683x1219',
        width: 2048,
        height: 3658,
        cellWidth: 683,
        cellHeight: 1219
      };
    } else {
      return {
        gridSize: '3658x2048',
        cellSize: '1219x683',
        width: 3658,
        height: 2048,
        cellWidth: 1219,
        cellHeight: 683
      };
    }
  } else {
    // 1K dimensions (current)
    if (isShort) {
      return {
        gridSize: '1080x1920',
        cellSize: '360x640',
        width: 1080,
        height: 1920,
        cellWidth: 360,
        cellHeight: 640
      };
    } else {
      return {
        gridSize: '1920x1080',
        cellSize: '640x360',
        width: 1920,
        height: 1080,
        cellWidth: 640,
        cellHeight: 360
      };
    }
  }
}

/**
 * Get the image size for a given model ID
 */
export function getModelImageSize(model: ImageModelId): ImageSize {
  return model === 'gemini-3-pro-image-preview' ? '2K' : '1K';
}
