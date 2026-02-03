/**
 * Dimension Utility - Centralized dimension calculations for asset generation
 * Provides consistent dimension calculations for 1K, 2K, and 4K resolutions
 *
 * Grid Dimensions (Pro Model - 3x3 grid):
 * | Resolution | 9:16 Grid | 9:16 Cell | 16:9 Grid | 16:9 Cell |
 * |------------|-----------|-----------|-----------|-----------|
 * | 1K | 768x1376 | 256x459 | 1376x768 | 459x256 |
 * | 2K | 1536x2752 | 512x917 | 2752x1536 | 917x512 |
 * | 4K | 3072x5504 | 1024x1835 | 5504x3072 | 1835x1024 |
 *
 * Individual Slide Dimensions (Non-Pro Model - single images):
 * | Resolution | 9:16 | 16:9 |
 * |------------|------|------|
 * | 1K | 768x1344 | 1344x768 |
 */

import type { ImageSize, ImageDimensions, ImageModelId } from '../types/video.js';

/**
 * Calculate grid dimensions based on video type and image size
 * Used for Pro model (gemini-3-pro-image-preview) with 3x3 grid generation
 */
export function calculateGridDimensions(
  videoType: 'short' | 'long',
  imageSize: ImageSize
): ImageDimensions {
  const isShort = videoType === 'short';

  if (imageSize === '4K') {
    if (isShort) {
      return {
        gridSize: '3072x5504',
        cellSize: '1024x1835',
        width: 3072,
        height: 5504,
        cellWidth: 1024,
        cellHeight: 1835
      };
    } else {
      return {
        gridSize: '5504x3072',
        cellSize: '1835x1024',
        width: 5504,
        height: 3072,
        cellWidth: 1835,
        cellHeight: 1024
      };
    }
  } else if (imageSize === '2K') {
    if (isShort) {
      return {
        gridSize: '1536x2752',
        cellSize: '512x917',
        width: 1536,
        height: 2752,
        cellWidth: 512,
        cellHeight: 917
      };
    } else {
      return {
        gridSize: '2752x1536',
        cellSize: '917x512',
        width: 2752,
        height: 1536,
        cellWidth: 917,
        cellHeight: 512
      };
    }
  } else {
    // 1K dimensions
    if (isShort) {
      return {
        gridSize: '768x1376',
        cellSize: '256x459',
        width: 768,
        height: 1376,
        cellWidth: 256,
        cellHeight: 459
      };
    } else {
      return {
        gridSize: '1376x768',
        cellSize: '459x256',
        width: 1376,
        height: 768,
        cellWidth: 459,
        cellHeight: 256
      };
    }
  }
}

/**
 * Calculate individual slide dimensions (non-grid)
 * Used for Non-Pro model (gemini-2.5-flash-image) with individual slide generation
 */
export function getIndividualSlideDimensions(
  videoType: 'short' | 'long'
): ImageDimensions {
  // Non-pro model only supports 1K individual slides
  if (videoType === 'short') {
    return {
      gridSize: '768x1344',
      cellSize: '768x1344',
      width: 768,
      height: 1344,
      cellWidth: 768,
      cellHeight: 1344
    };
  } else {
    return {
      gridSize: '1344x768',
      cellSize: '1344x768',
      width: 1344,
      height: 768,
      cellWidth: 1344,
      cellHeight: 768
    };
  }
}

/**
 * Get the image size for a given model ID
 * Pro model uses 4K by default, non-pro uses 1K
 */
export function getModelImageSize(model: ImageModelId): ImageSize {
  return model === 'gemini-3-pro-image-preview' ? '4K' : '1K';
}
