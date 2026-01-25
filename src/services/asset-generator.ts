/**
 * Asset Generator Service
 * Handles generation of grid images and slide audio using Gemini AI
 */

import { GoogleGenAI } from '@google/genai';
import type { VideoScript, ImageModelId, TTSModelId, TTSVoice, GridImageMetadata, SlideAudioMetadata } from '../types/video.js';
import { log } from '../lib/logger.js';

interface GridImageResult {
  base64: string;
  mimeType: string;
  metadata: GridImageMetadata;
}

interface SlideAudioResult {
  base64: string;
  mimeType: string;
  metadata: SlideAudioMetadata;
}

export class AssetGeneratorService {
  private genai: GoogleGenAI;

  constructor(apiKey: string) {
    this.genai = new GoogleGenAI({ apiKey });
  }

  /**
   * Generate all grid images for a video
   */
  async generateGridImages(
    reqId: string,
    script: VideoScript,
    videoType: 'short' | 'long',
    model: ImageModelId,
    referenceImages: string[] = []
  ): Promise<GridImageResult[]> {
    const isShort = videoType === 'short';
    const aspectRatio = isShort ? '9:16' : '16:9';
    const gridCount = isShort ? 1 : 2;
    const results: GridImageResult[] = [];

    log.assetGen.info(reqId, 'Starting grid image generation', {
      videoType,
      model,
      gridCount,
      slideCount: script.slides.length,
      referenceImageCount: referenceImages.length
    });

    for (let gridIndex = 0; gridIndex < gridCount; gridIndex++) {
      const slideIndices = this.getSlideIndicesForGrid(gridIndex, script.slides.length, isShort);
      const includeThumbnail = this.shouldIncludeThumbnail(gridIndex, script.slides.length, isShort);

      const prompt = this.buildGridImagePrompt(
        script,
        slideIndices,
        gridIndex,
        aspectRatio,
        includeThumbnail
      );

      const previousGrid = gridIndex === 1 && results.length > 0 ? results[0].base64 : undefined;

      log.assetGen.info(reqId, `Generating grid ${gridIndex}`, {
        slideIndices,
        includeThumbnail,
        hasPreviousGrid: !!previousGrid
      });

      const startTime = Date.now();
      const gridImage = await this.generateGridImage(
        prompt,
        aspectRatio,
        model,
        referenceImages,
        previousGrid
      );
      const durationMs = Date.now() - startTime;

      const metadata = this.buildGridMetadata(
        gridIndex,
        aspectRatio,
        slideIndices,
        includeThumbnail,
        isShort
      );

      results.push({
        base64: gridImage.base64,
        mimeType: gridImage.mimeType,
        metadata
      });

      log.assetGen.info(reqId, `Grid ${gridIndex} generated`, { durationMs });
    }

    return results;
  }

  /**
   * Generate audio for a single slide
   */
  async generateSlideAudio(
    reqId: string,
    narrationText: string,
    voiceName: TTSVoice,
    model: TTSModelId
  ): Promise<SlideAudioResult> {
    log.assetGen.info(reqId, 'Generating slide audio', {
      voiceName,
      model,
      textLength: narrationText.length
    });

    const startTime = Date.now();

    const response = await this.genai.models.generateContent({
      model,
      contents: narrationText,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    });

    // Log response structure for debugging
    log.assetGen.info(reqId, 'TTS response received', {
      hasCandidates: !!response.candidates,
      candidatesLength: response.candidates?.length || 0
    });

    if (!response.candidates || !response.candidates[0]) {
      log.assetGen.error(reqId, 'No candidates in TTS response', new Error('No candidates'), {
        response: JSON.stringify(response)
      });
      throw new Error('No candidates in TTS response');
    }

    const audioPart = response.candidates[0].content.parts[0];
    if (!audioPart || !audioPart.inlineData) {
      log.assetGen.error(reqId, 'No inline data in audio part', new Error('No inline data'), {
        audioPart: JSON.stringify(audioPart)
      });
      throw new Error('No inline data in audio response');
    }

    const pcmBase64 = audioPart.inlineData.data;

    // Convert PCM to WAV for browser playback
    const wavBase64 = this.pcmToWav(pcmBase64, 24000, 1, 16);

    // Calculate duration: bytes / (sampleRate * channels * bytesPerSample)
    const pcmBytes = atob(pcmBase64).length;
    const durationMs = (pcmBytes / (24000 * 1 * 2)) * 1000;

    const metadata: SlideAudioMetadata = {
      slideIndex: 0, // Will be set by caller
      voiceName,
      durationMs,
      sampleRate: 24000,
      channels: 1,
      bitDepth: 16
    };

    const elapsed = Date.now() - startTime;
    log.assetGen.info(reqId, 'Slide audio generated', { durationMs, elapsedMs: elapsed });

    return {
      base64: wavBase64,
      mimeType: 'audio/wav',
      metadata
    };
  }

  /**
   * Generate a single grid image using Gemini
   */
  private async generateGridImage(
    prompt: string,
    aspectRatio: '9:16' | '16:9',
    model: ImageModelId,
    referenceImages?: string[],
    previousGrid?: string
  ): Promise<{ base64: string; mimeType: string }> {
    // For Gemini image generation models, just pass the text prompt
    // The model automatically returns image data
    // Note: aspect ratio control and reference images may require different approach
    let fullPrompt = prompt;

    if (previousGrid) {
      fullPrompt += '\n\nIMPORTANT: Match the visual style, color palette, and artistic approach from the previous grid.';
    }

    const response = await this.genai.models.generateContent({
      model,
      contents: fullPrompt
    });

    if (!response.candidates || !response.candidates[0]) {
      throw new Error('No candidates in image generation response');
    }

    // Iterate through parts to find the image data
    const parts = response.candidates[0].content.parts;
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png'
        };
      }
    }

    // If no image found, log and throw error
    console.log('No image data found in response. Parts:', JSON.stringify(parts, null, 2));
    throw new Error('No image data in response from model ' + model);
  }

  /**
   * Build the prompt for grid image generation
   */
  private buildGridImagePrompt(
    script: VideoScript,
    slideIndices: number[],
    gridIndex: number,
    aspectRatio: '9:16' | '16:9',
    includeThumbnail: boolean
  ): string {
    const isShort = aspectRatio === '9:16';
    const gridSize = isShort ? '1080x1920' : '1920x1080';
    const cellSize = isShort ? '360x640' : '640x360';

    const cellDescriptions = slideIndices.map((slideIdx, cellPos) => {
      const slide = script.slides[slideIdx];
      if (!slide) return `Position ${cellPos}: PURE BLACK (#000000) - empty cell`;
      return `Position ${cellPos} (Slide ${slideIdx + 1}): ${slide.imageDescription}`;
    }).join('\n');

    const thumbnailSection = includeThumbnail
      ? `\nPosition 8 (Thumbnail): ${script.thumbnailDescription}`
      : '';

    const emptySection = slideIndices.length < 9 && !includeThumbnail
      ? `\nPositions ${slideIndices.length}-8: PURE BLACK (#000000) - fill unused cells completely black with no content`
      : '';

    return `
TASK: Generate a single ${gridSize} pixel image containing a 3x3 grid of ${isShort ? 'vertical (portrait)' : 'horizontal (landscape)'} images.

GRID LAYOUT:
- The output is ONE image divided into a 3x3 grid
- Each cell is ${cellSize} pixels
- Cells are numbered left-to-right, top-to-bottom: positions 0-8
- Grid lines should NOT be visible - images should tile seamlessly

STYLE REQUIREMENTS:
- Consistent visual style across ALL cells
- ${isShort ? 'Dramatic, attention-grabbing visuals suitable for social media shorts' : 'Professional, cinematic quality suitable for YouTube videos'}
- High contrast, vibrant colors
- Clear focal points in each cell
- Modern, polished aesthetic

CELL CONTENTS:
${cellDescriptions}${thumbnailSection}${emptySection}

CRITICAL: Generate exactly ONE image with all cells combined. Do NOT generate separate images.
`.trim();
  }

  /**
   * Determine which slide indices go in each grid
   */
  private getSlideIndicesForGrid(gridIndex: number, totalSlides: number, isShort: boolean): number[] {
    if (isShort) {
      // Short videos: 1 grid with up to 8 slides (position 8 is thumbnail)
      return Array.from({ length: Math.min(8, totalSlides) }, (_, i) => i);
    } else {
      // Long videos: 2 grids
      // Grid 0: slides 0-8 (9 slides)
      // Grid 1: slides 9-16 (up to 8 slides, position 8 is thumbnail)
      if (gridIndex === 0) {
        return Array.from({ length: Math.min(9, totalSlides) }, (_, i) => i);
      } else {
        const startIndex = 9;
        const remainingSlides = totalSlides - startIndex;
        const count = Math.min(8, remainingSlides);
        return Array.from({ length: count }, (_, i) => startIndex + i);
      }
    }
  }

  /**
   * Determine if this grid should include the thumbnail
   */
  private shouldIncludeThumbnail(gridIndex: number, totalSlides: number, isShort: boolean): boolean {
    if (isShort) {
      // Short: thumbnail always in position 8 of grid 0
      return gridIndex === 0;
    } else {
      // Long: thumbnail in position 8 of grid 1
      return gridIndex === 1;
    }
  }

  /**
   * Build metadata for a grid image
   */
  private buildGridMetadata(
    gridIndex: number,
    aspectRatio: '9:16' | '16:9',
    slideIndices: number[],
    includeThumbnail: boolean,
    isShort: boolean
  ): GridImageMetadata {
    const width = isShort ? 1080 : 1920;
    const height = isShort ? 1920 : 1080;
    const cellWidth = isShort ? 360 : 640;
    const cellHeight = isShort ? 640 : 360;

    const positions = [];

    // Add slide positions
    for (let i = 0; i < slideIndices.length; i++) {
      const cell = i;
      const row = Math.floor(cell / 3);
      const col = cell % 3;

      positions.push({
        cell,
        slideIndex: slideIndices[i],
        isThumbnail: false,
        isEmpty: false,
        cropRect: {
          x: col * cellWidth,
          y: row * cellHeight,
          w: cellWidth,
          h: cellHeight
        }
      });
    }

    // Add thumbnail if included
    if (includeThumbnail) {
      const cell = 8;
      const row = Math.floor(cell / 3);
      const col = cell % 3;

      positions.push({
        cell,
        slideIndex: null,
        isThumbnail: true,
        isEmpty: false,
        cropRect: {
          x: col * cellWidth,
          y: row * cellHeight,
          w: cellWidth,
          h: cellHeight
        }
      });
    }

    // Fill remaining cells as empty
    const usedCells = slideIndices.length + (includeThumbnail ? 1 : 0);
    for (let cell = usedCells; cell < 9; cell++) {
      const row = Math.floor(cell / 3);
      const col = cell % 3;

      positions.push({
        cell,
        slideIndex: null,
        isThumbnail: false,
        isEmpty: true,
        cropRect: {
          x: col * cellWidth,
          y: row * cellHeight,
          w: cellWidth,
          h: cellHeight
        }
      });
    }

    return {
      gridIndex,
      aspectRatio,
      width,
      height,
      cellWidth,
      cellHeight,
      positions
    };
  }

  /**
   * Convert PCM audio to WAV format with header
   */
  private pcmToWav(pcmBase64: string, sampleRate: number, channels: number, bitDepth: number): string {
    const pcm = Uint8Array.from(atob(pcmBase64), c => c.charCodeAt(0));
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    // RIFF header
    view.setUint32(0, 0x52494646, false);  // "RIFF"
    view.setUint32(4, 36 + pcm.length, true);
    view.setUint32(8, 0x57415645, false);  // "WAVE"

    // fmt subchunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);          // Subchunk size
    view.setUint16(20, 1, true);           // PCM format
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * bitDepth / 8, true);
    view.setUint16(32, channels * bitDepth / 8, true);
    view.setUint16(34, bitDepth, true);

    // data subchunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, pcm.length, true);

    const wav = new Uint8Array(44 + pcm.length);
    wav.set(new Uint8Array(header), 0);
    wav.set(pcm, 44);

    // Convert to base64 in chunks to avoid stack overflow
    const chunkSize = 8192; // Process 8KB at a time
    let binary = '';
    for (let i = 0; i < wav.length; i += chunkSize) {
      const chunk = wav.subarray(i, Math.min(i + chunkSize, wav.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  }
}
