import { describe, it, expect } from 'vitest';
import { calculateGridDimensions, getModelImageSize } from '../../../lib/dimensions.js';
import type { ImageModelId } from '../../../types/video.js';

describe('calculateGridDimensions', () => {
  it('should return 1K short dimensions', () => {
    const result = calculateGridDimensions('short', '1K');
    expect(result.width).toBe(768);
    expect(result.height).toBe(1376);
    expect(result.cellWidth).toBe(256);
    expect(result.cellHeight).toBe(459);
    expect(result.gridSize).toBe('768x1376');
    expect(result.cellSize).toBe('256x459');
  });

  it('should return 2K short dimensions', () => {
    const result = calculateGridDimensions('short', '2K');
    expect(result.width).toBe(1536);
    expect(result.height).toBe(2752);
    expect(result.cellWidth).toBe(512);
    expect(result.cellHeight).toBe(917);
    expect(result.gridSize).toBe('1536x2752');
    expect(result.cellSize).toBe('512x917');
  });

  it('should return 1K long dimensions', () => {
    const result = calculateGridDimensions('long', '1K');
    expect(result.width).toBe(1376);
    expect(result.height).toBe(768);
    expect(result.cellWidth).toBe(459);
    expect(result.cellHeight).toBe(256);
    expect(result.gridSize).toBe('1376x768');
    expect(result.cellSize).toBe('459x256');
  });

  it('should return 2K long dimensions', () => {
    const result = calculateGridDimensions('long', '2K');
    expect(result.width).toBe(2752);
    expect(result.height).toBe(1536);
    expect(result.cellWidth).toBe(917);
    expect(result.cellHeight).toBe(512);
    expect(result.gridSize).toBe('2752x1536');
    expect(result.cellSize).toBe('917x512');
  });

  it('should return 4K long dimensions', () => {
    const result = calculateGridDimensions('long', '4K');
    expect(result.width).toBe(5504);
    expect(result.height).toBe(3072);
    expect(result.cellWidth).toBe(1835);
    expect(result.cellHeight).toBe(1024);
    expect(result.gridSize).toBe('5504x3072');
    expect(result.cellSize).toBe('1835x1024');
  });
});

describe('getModelImageSize', () => {
  it('should return 4K for pro model', () => {
    expect(getModelImageSize('gemini-3-pro-image-preview')).toBe('4K');
  });

  it('should return 1K for flash model', () => {
    expect(getModelImageSize('gemini-2.5-flash-image')).toBe('1K');
  });
});
