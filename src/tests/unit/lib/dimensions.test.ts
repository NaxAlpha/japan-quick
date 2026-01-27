import { describe, it, expect } from 'vitest';
import { calculateGridDimensions, getModelImageSize } from '../../../lib/dimensions.js';
import type { ImageModelId } from '../../../types/video.js';

describe('calculateGridDimensions', () => {
  it('should return 1K short dimensions', () => {
    const result = calculateGridDimensions('short', '1K');
    expect(result.width).toBe(1080);
    expect(result.height).toBe(1920);
    expect(result.cellWidth).toBe(360);
    expect(result.cellHeight).toBe(640);
    expect(result.gridSize).toBe('1080x1920');
    expect(result.cellSize).toBe('360x640');
  });

  it('should return 2K short dimensions', () => {
    const result = calculateGridDimensions('short', '2K');
    expect(result.width).toBe(2048);
    expect(result.height).toBe(3658);
    expect(result.cellWidth).toBe(683);
    expect(result.cellHeight).toBe(1219);
    expect(result.gridSize).toBe('2048x3658');
    expect(result.cellSize).toBe('683x1219');
  });

  it('should return 1K long dimensions', () => {
    const result = calculateGridDimensions('long', '1K');
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.cellWidth).toBe(640);
    expect(result.cellHeight).toBe(360);
    expect(result.gridSize).toBe('1920x1080');
    expect(result.cellSize).toBe('640x360');
  });

  it('should return 2K long dimensions', () => {
    const result = calculateGridDimensions('long', '2K');
    expect(result.width).toBe(3658);
    expect(result.height).toBe(2048);
    expect(result.cellWidth).toBe(1219);
    expect(result.cellHeight).toBe(683);
    expect(result.gridSize).toBe('3658x2048');
    expect(result.cellSize).toBe('1219x683');
  });
});

describe('getModelImageSize', () => {
  it('should return 2K for pro model', () => {
    expect(getModelImageSize('gemini-3-pro-image-preview')).toBe('2K');
  });

  it('should return 1K for flash model', () => {
    expect(getModelImageSize('gemini-2.5-flash-image')).toBe('1K');
  });
});
