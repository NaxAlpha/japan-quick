/**
 * Asset Generator Service
 * Handles generation of grid images and slide audio using Gemini AI
 */

import { GoogleGenAI } from '@google/genai';
import type { VideoScript, ImageModelId, TTSModelId, TTSVoice, GridImageMetadata, SlideAudioMetadata, ImageSize } from '../types/video.js';
import { log } from '../lib/logger.js';
import { buildGridImagePrompt } from '../lib/prompts.js';
import { pcmToWav, calculatePcmDuration } from '../lib/audio-helper.js';
import { calculateGridDimensions, getModelImageSize } from '../lib/dimensions.js';

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

      const imageSize = getModelImageSize(model);

      const prompt = this.buildGridImagePrompt(
        script,
        slideIndices,
        gridIndex,
        aspectRatio,
        includeThumbnail,
        imageSize
      );

      const previousGrid = gridIndex === 1 && results.length > 0 ? results[0].base64 : undefined;

      log.assetGen.info(reqId, `Generating grid ${gridIndex}`, {
        slideIndices,
        includeThumbnail,
        hasPreviousGrid: !!previousGrid,
        imageSize
      });

      const startTime = Date.now();
      const gridImage = await this.generateGridImage(
        prompt,
        aspectRatio,
        model,
        imageSize,
        referenceImages,
        previousGrid
      );
      const durationMs = Date.now() - startTime;

      const metadata = this.buildGridMetadata(
        gridIndex,
        aspectRatio,
        slideIndices,
        includeThumbnail,
        isShort,
        imageSize
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
    const wavBase64 = pcmToWav(pcmBase64, 24000, 1, 16);

    // Calculate duration using helper
    const durationMs = calculatePcmDuration(pcmBase64, 24000, 1, 2);

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
    imageSize: ImageSize,
    referenceImages?: string[],
    previousGrid?: string
  ): Promise<{ base64: string; mimeType: string }> {
    // Build contents array with reference images and prompt
    // Reference images come first, then text prompt
    const contents: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];

    // Add reference images as inline data (parsed from JSON strings)
    if (referenceImages && referenceImages.length > 0) {
      for (const refImgStr of referenceImages) {
        try {
          const refImg = JSON.parse(refImgStr) as { mimeType: string; data: string };
          contents.push({
            inlineData: {
              mimeType: refImg.mimeType,
              data: refImg.data
            }
          });
        } catch {
          // Skip invalid reference image data
          continue;
        }
      }
    }

    // Add previous grid as reference if available
    if (previousGrid) {
      contents.push({
        inlineData: {
          mimeType: 'image/png',
          data: previousGrid
        }
      });
    }

    // Add text prompt last
    let textPrompt = prompt;
    if (previousGrid) {
      textPrompt += '\n\nIMPORTANT: Match the visual style, color palette, and artistic approach from the previous grid image.';
    }
    if (referenceImages && referenceImages.length > 0) {
      textPrompt += '\n\nREFERENCE IMAGES: The images above show the actual subjects, people, locations, and visual elements from the news article. Use them as visual reference to accurately depict the story content.';
    }
    contents.push({ text: textPrompt });

    // Build config - flash model doesn't support imageSize
    const isProModel = model === 'gemini-3-pro-image-preview';
    const config: {
      responseModalities: string[];
      imageConfig: {
        aspectRatio: string;
        imageSize?: string;
      };
    } = {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio
      }
    };

    // Only add imageSize for pro model
    if (isProModel) {
      config.imageConfig.imageSize = imageSize;
    }

    const response = await this.genai.models.generateContent({
      model,
      contents,  // Pass array with inline data + text
      config
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
    includeThumbnail: boolean,
    imageSize: ImageSize
  ): string {
    const isShort = aspectRatio === '9:16';
    const dimensions = calculateGridDimensions(isShort ? 'short' : 'long', imageSize);
    const { gridSize, cellSize } = dimensions;

    const cellDescriptions = slideIndices.map((slideIdx, cellPos) => {
      const slide = script.slides[slideIdx];
      if (!slide) return `Position ${cellPos}: A plain solid black image with absolutely no visible elements - no gradients, no patterns, no text, no highlights or shadows, just pure uniform black color (#000000) filling the entire cell area`;
      return `Position ${cellPos} (Slide ${slideIdx + 1}): ${slide.imageDescription}`;
    }).join('\n');

    const thumbnailSection = includeThumbnail
      ? `\nPosition 8 (Thumbnail): ${script.thumbnailDescription}`
      : '';

    const emptySection = slideIndices.length < 9 && !includeThumbnail
      ? `\nPositions ${slideIndices.length}-8: A plain solid black image with absolutely no visible elements - no gradients, no patterns, no text, no highlights or shadows, just pure uniform black color (#000000) filling the entire cell area`
      : '';

    return buildGridImagePrompt({
      isShort,
      gridSize,
      cellSize,
      cellDescriptions,
      thumbnailSection,
      emptySection
    });
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
    isShort: boolean,
    imageSize: ImageSize
  ): GridImageMetadata {
    const dimensions = calculateGridDimensions(isShort ? 'short' : 'long', imageSize);
    const { width, height, cellWidth, cellHeight } = dimensions;

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

}
