/**
 * Asset Generator Service
 * Handles generation of grid images, individual slide images, and slide audio using Gemini AI
 *
 * Pro Model (gemini-3-pro-image-preview): Grid generation with 4K resolution
 * Non-Pro Model (gemini-2.5-flash-image): Individual slide generation with 1K resolution
 */

import { GoogleGenAI } from '@google/genai';
import { ulid } from 'ulid';
import { Sandbox } from 'e2b';
import type { VideoScript, ImageModelId, TTSModelId, TTSVoice, GridImageMetadata, SlideAudioMetadata, ImageSize } from '../types/video.js';
import { log } from '../lib/logger.js';
import { buildGridImagePrompt, buildIndividualSlidePrompt } from '../lib/prompts.js';
import { pcmToWav, calculatePcmDuration } from '../lib/audio-helper.js';
import { calculateGridDimensions, getModelImageSize, getIndividualSlideDimensions } from '../lib/dimensions.js';

interface GridImageResult {
  base64: string;
  mimeType: string;
  metadata: GridImageMetadata;
  ulid: string;
}

interface SlideImageResult {
  base64: string;
  mimeType: string;
  metadata: { slideIndex: number };
  ulid: string;
}

interface ThumbnailResult {
  base64: string;
  mimeType: string;
}

interface SlideAudioResult {
  base64: string;
  mimeType: string;
  metadata: SlideAudioMetadata;
  ulid: string;
  tokenUsage: TokenUsageInfo;
}

interface PromptResult {
  gridIndex: number;
  prompt: string;
}

interface TokenUsageInfo {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}


export class AssetGeneratorService {
  private genai: GoogleGenAI;
  private e2bApiKey: string;

  constructor(apiKey: string, e2bApiKey: string) {
    this.genai = new GoogleGenAI({ apiKey });
    this.e2bApiKey = e2bApiKey;
  }

  /**
   * Generate all images for a video - branches based on model
   * Pro model: Grid generation (4K)
   * Non-pro model: Individual slide generation (1K)
   */
  async generateImages(
    reqId: string,
    script: VideoScript,
    videoType: 'short' | 'long',
    model: ImageModelId,
    referenceImages: string[] = []
  ): Promise<{ grids: GridImageResult[]; slides: SlideImageResult[]; prompts: PromptResult[]; tokenUsage: TokenUsageInfo[]; thumbnail?: ThumbnailResult }> {
    const isProModel = model === 'gemini-3-pro-image-preview';

    log.assetGen.info(reqId, 'Starting image generation', {
      videoType,
      model,
      isProModel,
      slideCount: script.slides.length,
      referenceImageCount: referenceImages.length
    });

    if (isProModel) {
      // Pro model: Use grid generation
      return await this.generateGridImages(reqId, script, videoType, model, referenceImages);
    } else {
      // Non-pro model: Use individual slide generation
      return await this.generateIndividualSlides(reqId, script, videoType, model, referenceImages);
    }
  }

  /**
   * Generate all grid images and individual slide images for a video (Pro model only)
   * Uses cross-image (pure JS) to split grids into individual slides
   */
  async generateGridImages(
    reqId: string,
    script: VideoScript,
    videoType: 'short' | 'long',
    model: ImageModelId,
    referenceImages: string[] = []
  ): Promise<{ grids: GridImageResult[]; slides: SlideImageResult[]; prompts: PromptResult[]; tokenUsage: TokenUsageInfo[]; thumbnail?: ThumbnailResult }> {
    const isShort = videoType === 'short';
    const aspectRatio = isShort ? '9:16' : '16:9';
    const gridCount = isShort ? 1 : 2;
    const grids: GridImageResult[] = [];
    const prompts: PromptResult[] = [];
    const tokenUsage: TokenUsageInfo[] = [];

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

      const previousGrid = gridIndex === 1 && grids.length > 0 ? grids[0].base64 : undefined;

      log.assetGen.info(reqId, `Generating grid ${gridIndex}`, {
        slideIndices,
        includeThumbnail,
        hasPreviousGrid: !!previousGrid,
        imageSize
      });

      const startTime = Date.now();
      const { image: gridImage, tokenUsage: tokens } = await this.generateGridImage(
        reqId,
        prompt,
        aspectRatio,
        model,
        imageSize,
        referenceImages,
        previousGrid
      );
      const durationMs = Date.now() - startTime;

      // Store prompt for this grid
      prompts.push({ gridIndex, prompt });
      tokenUsage.push(tokens);

      const metadata = this.buildGridMetadata(
        gridIndex,
        aspectRatio,
        slideIndices,
        includeThumbnail,
        isShort,
        imageSize
      );

      const gridUlid = ulid();

      grids.push({
        base64: gridImage.base64,
        mimeType: gridImage.mimeType,
        metadata,
        ulid: gridUlid
      });

      log.assetGen.info(reqId, `Grid ${gridIndex} generated`, { durationMs, ulid: gridUlid, tokens });
    }

    // Split grids into individual slide images using ImageScript
    const { slides, thumbnail } = await this.splitGridsIntoSlides(reqId, grids, videoType);

    return { grids, slides, prompts, tokenUsage, thumbnail };
  }

  /**
   * Generate individual slide images for each slide (Non-pro model only)
   * No grid generation - each slide is generated separately
   */
  async generateIndividualSlides(
    reqId: string,
    script: VideoScript,
    videoType: 'short' | 'long',
    model: ImageModelId,
    referenceImages: string[] = []
  ): Promise<{ grids: GridImageResult[]; slides: SlideImageResult[]; prompts: PromptResult[]; tokenUsage: TokenUsageInfo[]; thumbnail?: ThumbnailResult }> {
    const isShort = videoType === 'short';
    const aspectRatio = isShort ? '9:16' : '16:9';
    const dimensions = getIndividualSlideDimensions(videoType);
    const slides: SlideImageResult[] = [];
    const tokenUsage: TokenUsageInfo[] = [];

    log.assetGen.info(reqId, 'Starting individual slide generation', {
      videoType,
      model,
      slideCount: script.slides.length,
      referenceImageCount: referenceImages.length,
      dimensions: dimensions.gridSize
    });

    for (let slideIndex = 0; slideIndex < script.slides.length; slideIndex++) {
      const slide = script.slides[slideIndex];

      const prompt = buildIndividualSlidePrompt({
        slideHeadline: slide.headline,
        imageDescription: slide.imageDescription,
        width: dimensions.width,
        height: dimensions.height,
        aspectRatio
      });

      log.assetGen.info(reqId, `Generating slide ${slideIndex}`, {
        headline: slide.headline,
        dimensions: dimensions.gridSize
      });

      const startTime = Date.now();
      const { image: slideImage, tokenUsage: tokens } = await this.generateSlideImage(
        reqId,
        prompt,
        aspectRatio,
        model,
        dimensions,
        referenceImages
      );
      const durationMs = Date.now() - startTime;

      tokenUsage.push(tokens);

      const slideUlid = ulid();

      slides.push({
        base64: slideImage.base64,
        mimeType: slideImage.mimeType,
        metadata: { slideIndex },
        ulid: slideUlid
      });

      log.assetGen.info(reqId, `Slide ${slideIndex} generated`, { durationMs, ulid: slideUlid, tokens });
    }

    // No grids for individual slide generation
    // Use the last slide as thumbnail for non-pro model
    const lastSlide = slides[slides.length - 1];
    const thumbnail = lastSlide ? {
      base64: lastSlide.base64,
      mimeType: lastSlide.mimeType
    } : undefined;

    return { grids: [], slides, prompts: [], tokenUsage, thumbnail };
  }

  /**
   * Split grid images into individual slide images using E2B sandbox with ImageMagick
   * Also extracts thumbnail from position 8 of the appropriate grid
   * This avoids Cloudflare Workers 128MB memory limit for 4K grids
   */
  private async splitGridsIntoSlides(
    reqId: string,
    grids: GridImageResult[],
    videoType: 'short' | 'long'
  ): Promise<{ slides: SlideImageResult[]; thumbnail?: ThumbnailResult }> {
    const allSlides: SlideImageResult[] = [];

    log.assetGen.info(reqId, 'Starting grid splitting with E2B sandbox', {
      gridCount: grids.length,
      videoType,
      apiKeyPrefix: this.e2bApiKey?.substring(0, 10) || 'none'
    });

    // Determine which grid contains the thumbnail (position 8)
    // Short: grid 0, Long: grid 1
    const thumbnailGridIndex = videoType === 'short' ? 0 : 1;
    let extractedThumbnail: ThumbnailResult | undefined;

    let sandbox: Sandbox | null = null;

    try {
      // Create E2B sandbox
      log.assetGen.info(reqId, 'Creating E2B sandbox for grid splitting');
      sandbox = await Sandbox.create('video-renderer', {
        apiKey: this.e2bApiKey,
        timeoutMs: 300000 // 5 minutes timeout
      });
      log.assetGen.info(reqId, 'E2B sandbox created', { sandboxId: sandbox.sandboxId });

      // Process each grid
      for (const grid of grids) {
        const isThumbnailGrid = grid.metadata.gridIndex === thumbnailGridIndex;
        const gridFileName = `/home/user/grid_${grid.metadata.gridIndex}.png`;

        // Write grid base64 to file in sandbox
        log.assetGen.info(reqId, `Writing grid ${grid.metadata.gridIndex} to sandbox`, {
          base64Length: grid.base64.length
        });

        // Convert base64 to buffer and write to sandbox
        const gridBuffer = Buffer.from(grid.base64, 'base64');
        await sandbox.files.write(gridFileName, gridBuffer);

        log.assetGen.info(reqId, `Grid ${grid.metadata.gridIndex} written to sandbox`, {
          byteLength: gridBuffer.byteLength
        });

        // Use ImageMagick to split the grid into 9 slides
        // Output format: slide_<gridIndex>_<cellIndex>.png (0-indexed)
        const outputPattern = `/home/user/slide_${grid.metadata.gridIndex}_%d.png`;
        const convertCmd = `convert ${gridFileName} -crop 3x3 +repage -quality 90 ${outputPattern}`;

        log.assetGen.info(reqId, `Splitting grid ${grid.metadata.gridIndex} with ImageMagick`, {
          command: convertCmd
        });

        const convertResult = await sandbox.commands.run(convertCmd, { timeoutMs: 60000 });

        if (convertResult.exitCode !== 0) {
          log.assetGen.error(reqId, `ImageMagick convert failed for grid ${grid.metadata.gridIndex}`, new Error('convert failed'), {
            stderr: convertResult.stderr,
            stdout: convertResult.stdout
          });
          throw new Error(`Failed to split grid ${grid.metadata.gridIndex}: ${convertResult.stderr}`);
        }

        log.assetGen.info(reqId, `Grid ${grid.metadata.gridIndex} split successfully`, {
          stdout: convertResult.stdout
        });

        // List the generated slide files to verify
        const listResult = await sandbox.commands.run(`ls -la /home/user/slide_${grid.metadata.gridIndex}_*.png 2>&1`);
        log.assetGen.info(reqId, `Generated slide files for grid ${grid.metadata.gridIndex}`, {
          output: listResult.stdout || listResult.stderr
        });

        // Process each position from the grid metadata
        for (const pos of grid.metadata.positions) {
          const slideFileName = `/home/user/slide_${grid.metadata.gridIndex}_${pos.cell}.png`;

          // Handle thumbnail extraction (position 8 of thumbnail grid)
          if (isThumbnailGrid && pos.cell === 8 && pos.isThumbnail) {
            log.assetGen.info(reqId, 'Extracting thumbnail from position 8', {
              gridIndex: grid.metadata.gridIndex,
              fileName: slideFileName
            });

            const thumbnailBuffer = await sandbox.files.read(slideFileName);
            const thumbnailBase64 = Buffer.from(thumbnailBuffer).toString('base64');

            extractedThumbnail = {
              base64: thumbnailBase64,
              mimeType: 'image/jpeg'
            };

            log.assetGen.info(reqId, 'Thumbnail extracted', {
              bufferByteLength: thumbnailBuffer.byteLength,
              base64Length: thumbnailBase64.length
            });

            continue; // Skip adding thumbnail as a slide
          }

          // Skip empty cells and thumbnail cells
          if (pos.isEmpty || pos.isThumbnail) continue;
          if (pos.slideIndex === null) continue;

          // Read the slide file (STREAMING: one at a time)
          log.assetGen.debug(reqId, `Reading slide ${pos.slideIndex}`, {
            fileName: slideFileName
          });

          const slideBuffer = await sandbox.files.read(slideFileName);
          const slideBase64 = Buffer.from(slideBuffer).toString('base64');
          const slideUlid = ulid();

          allSlides.push({
            base64: slideBase64,
            mimeType: 'image/png',
            metadata: { slideIndex: pos.slideIndex },
            ulid: slideUlid
          });

          log.assetGen.info(reqId, `Slide ${pos.slideIndex} extracted`, {
            slideIndex: pos.slideIndex,
            ulid: slideUlid,
            bufferByteLength: slideBuffer.byteLength
          });

          // Buffer goes out of scope here - garbage collected
        }
      }

      log.assetGen.info(reqId, 'Grid splitting complete', {
        totalSlides: allSlides.length,
        thumbnailExtracted: !!extractedThumbnail
      });

      // Sort slides by slideIndex to ensure correct order
      allSlides.sort((a, b) => a.metadata.slideIndex - b.metadata.slideIndex);

      return { slides: allSlides, thumbnail: extractedThumbnail };
    } finally {
      // Always kill sandbox to prevent orphans
      if (sandbox) {
        log.assetGen.debug(reqId, 'Killing E2B sandbox');
        await sandbox.kill();
        log.assetGen.debug(reqId, 'E2B sandbox killed');
      }
    }
  }

  /**
   * Generate audio for a single slide
   */
  async generateSlideAudio(
    reqId: string,
    narrationText: string,
    voiceName: TTSVoice,
    model: TTSModelId,
    directorNotes?: string,  // NEW parameter
    audioProfile?: string    // NEW parameter
  ): Promise<SlideAudioResult> {
    log.assetGen.info(reqId, 'Generating slide audio', {
      voiceName,
      model,
      textLength: narrationText.length,
      hasDirectorNotes: !!directorNotes,
      audioProfile
    });

    const startTime = Date.now();

    // Build enhanced prompt with director's notes if provided
    let enhancedPrompt = narrationText;

    if (directorNotes || audioProfile) {
      const styleInstructions = [];

      if (audioProfile) {
        const profileGuidance: Record<string, string> = {
          urgent: 'Fast-paced, urgent, breaking news delivery',
          calm: 'Measured, reassuring, explanatory delivery',
          excited: 'Energetic, enthusiastic, positive delivery',
          serious: 'Grave, important, weighty delivery',
          casual: 'Relaxed, friendly, conversational delivery',
          dramatic: 'Heightened emotion, impactful delivery'
        };
        styleInstructions.push(`AUDIO PROFILE: ${profileGuidance[audioProfile] || audioProfile}`);
      }

      if (directorNotes) {
        styleInstructions.push(`DIRECTOR'S NOTES: ${directorNotes}`);
      }

      enhancedPrompt = `${styleInstructions.join('\n\n')}\n\nNARRATION:\n${narrationText}`;
    }

    const response = await this.genai.models.generateContent({
      model,
      contents: enhancedPrompt,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    });

    // Extract token usage from response
    const usageMetadata = response.usageMetadata;
    const tokenUsage: TokenUsageInfo = {
      inputTokens: usageMetadata?.promptTokenCount || 0,
      outputTokens: usageMetadata?.candidatesTokenCount || 0,
      totalTokens: usageMetadata?.totalTokenCount || 0
    };

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

    const audioPart = response.candidates?.[0]?.content?.parts?.[0];
    if (!audioPart?.inlineData?.data) {
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
    const audioUlid = ulid();

    log.assetGen.info(reqId, 'Slide audio generated', { durationMs, elapsedMs: elapsed, ulid: audioUlid, tokenUsage });

    return {
      base64: wavBase64,
      mimeType: 'audio/wav',
      metadata,
      ulid: audioUlid,
      tokenUsage
    };
  }

  /**
   * Generate a single slide image using Gemini (for non-pro model individual slide generation)
   */
  private async generateSlideImage(
    reqId: string,
    prompt: string,
    aspectRatio: '9:16' | '16:9',
    model: ImageModelId,
    dimensions: { width: number; height: number },
    referenceImages?: string[]
  ): Promise<{ image: { base64: string; mimeType: string }; tokenUsage: TokenUsageInfo }> {
    // Build contents array with reference images and prompt
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

    // Add text prompt with reference images context
    let textPrompt = prompt;
    if (referenceImages && referenceImages.length > 0) {
      textPrompt += '\n\nREFERENCE IMAGES: The images above show the actual subjects, people, locations, and visual elements from the news article. Use them as visual reference to accurately depict the story content.';
    }
    contents.push({ text: textPrompt });

    // Non-pro model doesn't support imageSize, only aspectRatio
    const config: {
      responseModalities: string[];
      imageConfig: {
        aspectRatio: string;
      };
    } = {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio
      }
    };

    const response = await this.genai.models.generateContent({
      model,
      contents,
      config
    });

    // Extract token usage
    const tokenUsage = this.extractTokenUsage(response);

    if (!response.candidates || !response.candidates[0]) {
      throw new Error('No candidates in image generation response');
    }

    // Iterate through parts to find the image data
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part?.inlineData?.data) {
        return {
          image: {
            base64: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png'
          },
          tokenUsage
        };
      }
    }

    // If no image found, log and throw error
    log.assetGen.error(reqId, 'No image data in response', new Error('No image data'), {
      model,
      parts: JSON.stringify(parts)
    });
    throw new Error('No image data in response from model ' + model);
  }

  /**
   * Generate a single grid image using Gemini
   */
  private async generateGridImage(
    reqId: string,
    prompt: string,
    aspectRatio: '9:16' | '16:9',
    model: ImageModelId,
    imageSize: ImageSize,
    referenceImages?: string[],
    previousGrid?: string
  ): Promise<{ image: { base64: string; mimeType: string }; tokenUsage: TokenUsageInfo }> {
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

    // Extract token usage
    const tokenUsage = this.extractTokenUsage(response);

    if (!response.candidates || !response.candidates[0]) {
      throw new Error('No candidates in image generation response');
    }

    // Iterate through parts to find the image data
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part?.inlineData?.data) {
        return {
          image: {
            base64: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png'
          },
          tokenUsage
        };
      }
    }

    // If no image found, log and throw error
    log.assetGen.error(reqId, 'No image data in response', new Error('No image data'), {
      model,
      parts: JSON.stringify(parts)
    });
    throw new Error('No image data in response from model ' + model);
  }

  /**
   * Extract token usage from Gemini response
   */
  private extractTokenUsage(response: any): TokenUsageInfo {
    // Gemini API response may contain usage metadata
    // For image generation, tokens are typically 0 input, fixed output based on resolution
    const usageMetadata = response.usageMetadata;
    if (usageMetadata) {
      return {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0
      };
    }

    // Default fallback (image generation typically uses 0 input, estimated output)
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    };
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

    // Build descriptions for ALL 9 positions explicitly
    // This ensures the AI generates a complete 3x3 grid with no missing cells
    const cellDescriptions: string[] = [];
    const blankCellDescription = 'A plain solid black image with absolutely no visible elements - no gradients, no patterns, no text, no highlights or shadows, just pure uniform black color (#000000) filling the entire cell area';

    for (let pos = 0; pos < 9; pos++) {
      if (pos === 8 && includeThumbnail) {
        // Position 8 is reserved for thumbnail, added via thumbnailSection below
        continue;
      }

      // Check if this position has a slide from slideIndices
      const slideIdx = slideIndices[pos];
      if (slideIdx !== undefined && script.slides[slideIdx]) {
        cellDescriptions.push(
          `Position ${pos} (Slide ${slideIdx + 1}): ${script.slides[slideIdx].imageDescription}`
        );
      } else {
        // Empty position - fill with black
        cellDescriptions.push(`Position ${pos}: ${blankCellDescription}`);
      }
    }

    const cellDescriptionsText = cellDescriptions.join('\n');

    const thumbnailSection = includeThumbnail
      ? `\nPosition 8 (Thumbnail): ${script.thumbnailDescription}`
      : '';

    // emptySection no longer needed - all positions handled above
    const emptySection = '';

    return buildGridImagePrompt({
      isShort,
      gridSize,
      cellSize,
      cellDescriptions: cellDescriptionsText,
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
