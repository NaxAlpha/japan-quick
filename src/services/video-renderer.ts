/**
 * Video Renderer Service
 * Uses e2b sandbox with Remotion to render videos from slide images and audio
 * Remotion project is pre-bundled in E2B template, uses remotion render CLI
 */

import type { VideoScript, VideoType, RenderedVideoMetadata } from '../types/video.js';
import { log } from '../lib/logger.js';
import { Sandbox } from 'e2b';
import { VIDEO_RENDERING } from '../lib/constants.js';

interface SlideImageAsset {
  url: string;      // Public URL to download from
  slideIndex: number;
}

interface AudioAsset {
  url: string;      // Public URL to download from
  slideIndex: number;
  durationMs: number;
}

interface RenderInput {
  script: VideoScript;
  videoType: VideoType;
  slideImages: SlideImageAsset[];
  audio: AudioAsset[];
  articleDate: string; // ISO date string for date badge
}

interface RenderOutput {
  videoBase64: string;  // Base64 encoded video content (read from sandbox before killing)
  metadata: RenderedVideoMetadata;
}

/**
 * Build inputProps JSON for Remotion and write to sandbox
 * Remotion will fetch assets directly from public URLs
 */
async function writeRemotionInputProps(
  reqId: string,
  sandbox: Sandbox,
  input: RenderInput
): Promise<string> {
  log.videoRenderer.info(reqId, 'Building Remotion inputProps', {
    slideCount: input.slideImages.length,
    audioCount: input.audio.length
  });

  // Build slides array for Remotion with URLs and durations
  const slides = input.audio.map((audio) => {
    const slideImage = input.slideImages.find(s => s.slideIndex === audio.slideIndex);
    if (!slideImage) {
      throw new Error(`No slide image found for audio at slideIndex ${audio.slideIndex}`);
    }

    const slide = input.script.slides[audio.slideIndex];
    if (!slide) {
      throw new Error(`No script slide found for slideIndex ${audio.slideIndex}`);
    }

    // Convert duration to frames at 30 FPS
    const durationInFrames = Math.ceil((audio.durationMs / 1000) * 30);

    return {
      imageUrl: slideImage.url,
      audioUrl: audio.url,
      headline: slide.headline || undefined,
      durationInFrames
    };
  });

  const inputProps = {
    slides,
    videoType: input.videoType,
    articleDate: input.articleDate
  };

  const inputPropsJson = JSON.stringify(inputProps, null, 2);
  log.videoRenderer.debug(reqId, 'InputProps JSON', {
    length: inputPropsJson.length,
    preview: inputPropsJson.substring(0, 500)
  });

  // Write inputProps to sandbox
  const propsPath = '/home/user/remotion/inputProps.json';
  await sandbox.files.write(propsPath, inputPropsJson);
  log.videoRenderer.info(reqId, 'InputProps written to sandbox', { path: propsPath });

  return propsPath;
}

/**
 * Execute Remotion render command to generate video
 * Uses pre-bundled Remotion project in /home/user/remotion
 */
async function executeRemotion(
  reqId: string,
  sandbox: Sandbox,
  inputPropsPath: string,
  input: RenderInput
): Promise<string> {
  log.videoRenderer.info(reqId, 'Starting Remotion render', {
    videoType: input.videoType,
    slideCount: input.slideImages.length
  });

  const outputPath = '/tmp/output.webm';

  // Resolution and dimensions based on video type
  const width = input.videoType === 'short' ? 1080 : 1920;
  const height = input.videoType === 'short' ? 1920 : 1080;

  // Calculate total duration in frames (30 FPS)
  const totalDurationMs = input.audio.reduce((sum, a) => sum + a.durationMs, 0);
  const transitionOverlapMs = (input.audio.length - 1) * 1000; // 1s overlap per transition
  const totalFrames = Math.ceil(((totalDurationMs - transitionOverlapMs) / 1000) * 30);

  // Build remotion render command with memory optimizations for long videos
  const remotionCommand = [
    'cd /home/user/remotion &&',
    'bunx remotion render',
    'DynamicVideo',
    outputPath,
    '--props', inputPropsPath,
    '--overwrite',
    '--codec', 'vp8',
    '--audio-codec', 'opus',
    '--concurrency', '1',              // Single thread to avoid Chrome crashes
    '--gl', 'swangle',                  // Software renderer (stable for long renders)
    '--scale', '0.5',                   // Render at 540p to prevent memory issues
    '--disallow-parallel-encoding'      // Memory-efficient: don't render+encode simultaneously
  ].join(' ');

  log.videoRenderer.info(reqId, 'Remotion command', {
    cmd: remotionCommand,
    width,
    height,
    totalFrames,
    totalDurationMs
  });

  const startTime = Date.now();
  let stdoutOutput = '';
  let stderrOutput = '';

  try {
    const result = await sandbox.commands.run(remotionCommand, {
      timeoutMs: VIDEO_RENDERING.FFMPEG_TIMEOUT_MS, // Use same timeout as FFmpeg
      onStdout: (data) => {
        stdoutOutput += data + '\n';
        log.videoRenderer.info(reqId, 'remotion stdout: ' + data.trim());
      },
      onStderr: (data) => {
        stderrOutput += data + '\n';
        log.videoRenderer.info(reqId, 'remotion stderr: ' + data.trim());
      }
    });

    log.videoRenderer.info(reqId, 'Remotion process completed', {
      exitCode: result.exitCode,
      stdoutLength: stdoutOutput.length,
      stderrLength: stderrOutput.length
    });

    if (result.exitCode !== 0) {
      throw new Error(`Remotion render failed with exit code ${result.exitCode}`);
    }
  } catch (remotionError) {
    const errorMsg = `Remotion failed: ${(remotionError as Error).message}`;
    log.videoRenderer.error(reqId, 'Remotion error output', {
      fullStderr: stderrOutput,
      fullStdout: stdoutOutput
    });
    throw new Error(`${errorMsg}\nStderr: ${stderrOutput.slice(-2000)}`);
  }

  const duration = Date.now() - startTime;
  log.videoRenderer.info(reqId, 'Remotion render completed', { durationMs: duration });

  // Verify output file
  const checkResult = await sandbox.commands.run(`ls -lh ${outputPath} 2>&1`);
  log.videoRenderer.info(reqId, 'Output check', { output: checkResult.stdout || checkResult.stderr });

  return outputPath;
}

/**
 * Calculate video metadata from input and output
 */
function getMetadata(outputPath: string, input: RenderInput): RenderedVideoMetadata {
  const totalAudioDuration = input.audio.reduce((sum, a) => sum + a.durationMs, 0) / 1000;
  // Account for cross-fade overlaps (1 second per transition)
  const transitionOverlap = (input.audio.length - 1) * VIDEO_RENDERING.TRANSITION_DURATION_S;
  const totalDuration = totalAudioDuration - transitionOverlap;

  return {
    width: input.videoType === 'short' ? 1080 : 1920,
    height: input.videoType === 'short' ? 1920 : 1080,
    durationMs: Math.round(totalDuration * 1000),
    fps: 30, // Remotion uses 30 FPS
    videoCodec: 'VP8',
    audioCodec: 'Opus',
    format: 'webm'
  };
}

/**
 * Main render function using e2b sandbox
 * @param reqId - Request ID for logging
 * @param e2bApiKey - E2B API key
 * @param input - Render input with script, images, audio, etc.
 * @returns Download URL and metadata
 */
export async function renderVideo(
  reqId: string,
  e2bApiKey: string,
  input: RenderInput
): Promise<RenderOutput> {
  log.videoRenderer.info(reqId, 'Video render started', {
    slideCount: input.script.slides.length,
    videoType: input.videoType,
    slideImageCount: input.slideImages.length,
    audioCount: input.audio.length
  });

  // Validate input before starting render
  if (input.slideImages.length !== input.audio.length) {
    throw new Error(
      `Slide/audio count mismatch: ${input.slideImages.length} slides, ` +
      `${input.audio.length} audio. Expected 1:1 mapping.`
    );
  }

  for (const audio of input.audio) {
    if (!audio.durationMs || isNaN(audio.durationMs) || audio.durationMs <= 0) {
      throw new Error(`Invalid durationMs for audio at slideIndex ${audio.slideIndex}: ${audio.durationMs}`);
    }
  }

  const slideIndices = new Set(input.slideImages.map(s => s.slideIndex));
  if (slideIndices.size !== input.slideImages.length) {
    throw new Error('Duplicate slide indices detected in slideImages');
  }

  let sandbox: Sandbox | null = null;

  try {
    // Create sandbox with custom video-renderer template (pre-installed ffmpeg, curl, fonts)
    log.videoRenderer.info(reqId, 'Creating e2b sandbox', {
      template: 'video-renderer',
      timeoutMs: 600000,
      apiKeyLength: e2bApiKey?.length || 0,
      apiKeyPrefix: e2bApiKey?.substring(0, 10) || 'none'
    });

    // Ensure apiKey is not empty/undefined
    if (!e2bApiKey) {
      throw new Error('E2B_API_KEY is not set or empty');
    }

    sandbox = await Sandbox.create('video-renderer', {
      apiKey: e2bApiKey,
      timeoutMs: 900000 // 15 minutes - for longer videos with Chromium download buffer
    });

    log.videoRenderer.info(reqId, 'E2B sandbox created', {
      sandboxId: sandbox.sandboxId
    });

    // Step 1: Write inputProps JSON for Remotion
    log.videoRenderer.info(reqId, 'Step 1/2: Writing inputProps for Remotion');
    const inputPropsPath = await writeRemotionInputProps(reqId, sandbox, input);

    // Step 2: Execute Remotion render
    log.videoRenderer.info(reqId, 'Step 2/2: Rendering video with Remotion');
    const outputPath = await executeRemotion(reqId, sandbox, inputPropsPath, input);

    // Step 3: Verify output video is valid using ffprobe
    log.videoRenderer.info(reqId, 'Verifying output video with ffprobe');
    try {
      const ffprobeResult = await sandbox.commands.run(
        `ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of default=noprint_wrappers=1 ${outputPath}`
      );
      log.videoRenderer.info(reqId, 'FFprobe verification passed', {
        output: ffprobeResult.stdout?.substring(0, 500) || ffprobeResult.stderr?.substring(0, 500)
      });
    } catch (ffprobeError) {
      log.videoRenderer.error(reqId, 'FFprobe verification failed', ffprobeError as Error);
      throw new Error(`Output video verification failed: ${(ffprobeError as Error).message}`);
    }

    // Step 4: Read video file content directly (before killing sandbox)
    log.videoRenderer.info(reqId, 'Reading video file content from sandbox');
    const fileContentRaw = await sandbox.files.read(outputPath);

    log.videoRenderer.debug(reqId, 'File read from sandbox', {
      contentType: typeof fileContentRaw,
      isArrayBuffer: fileContentRaw instanceof ArrayBuffer,
      isUint8Array: fileContentRaw instanceof Uint8Array,
      hasLength: 'length' in fileContentRaw ? (fileContentRaw as any).length : 'N/A'
    });

    // Convert to Uint8Array if it's not already
    const fileBytes = fileContentRaw instanceof Uint8Array
      ? fileContentRaw
      : new Uint8Array(fileContentRaw);

    log.videoRenderer.debug(reqId, 'Converted to Uint8Array', {
      byteLength: fileBytes.byteLength,
      firstByte: fileBytes[0],
      lastByte: fileBytes[fileBytes.byteLength - 1]
    });

    // Convert Uint8Array to base64 string properly
    let binary = '';
    for (let i = 0; i < fileBytes.byteLength; i++) {
      binary += String.fromCharCode(fileBytes[i]);
    }
    const fileBase64 = btoa(binary);

    log.videoRenderer.info(reqId, 'Video file read successfully', {
      byteLength: fileBytes.byteLength,
      base64Length: fileBase64.length,
      base64Preview: fileBase64.substring(0, 100)
    });

    // Get video metadata
    const metadata = getMetadata(outputPath, input);

    log.videoRenderer.info(reqId, 'Video render completed successfully', {
      fileSize: fileBase64.length,
      durationMs: metadata.durationMs,
      resolution: `${metadata.width}x${metadata.height}`
    });

    return {
      videoBase64: fileBase64,
      metadata
    };
  } catch (error) {
    log.videoRenderer.error(reqId, 'Video render failed', error as Error, {
      errorType: (error as Error).constructor.name,
      errorMessage: (error as Error).message
    });
    throw error;
  } finally {
    // Always kill sandbox to prevent orphans
    if (sandbox) {
      log.videoRenderer.debug(reqId, 'Killing e2b sandbox');
      await sandbox.kill();
      log.videoRenderer.debug(reqId, 'E2B sandbox killed');
    }
  }
}
