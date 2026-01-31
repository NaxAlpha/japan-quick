/**
 * Video Renderer Service
 * Uses e2b sandbox with ffmpeg to render videos from individual slide images and audio
 * Optimized for speed: ~5min video rendered in 2-3 minutes
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
 * Download assets from public URLs to the sandbox
 * Uses curl inside the sandbox for efficient downloads
 */
async function downloadAssets(
  reqId: string,
  sandbox: Sandbox,
  input: RenderInput
): Promise<{ slidePaths: string[]; audioPaths: string[] }> {
  log.videoRenderer.debug(reqId, 'Downloading assets to sandbox', {
    slideImageCount: input.slideImages.length,
    audioCount: input.audio.length
  });

  const slidePaths: string[] = [];
  const audioPaths: string[] = [];

  try {
    // Create directories in home directory (writable by non-root user)
    log.videoRenderer.debug(reqId, 'Creating directories in /tmp');
    await sandbox.commands.run('mkdir -p /tmp/slides /tmp/audio', {
      onStdout: (data) => log.videoRenderer.debug(reqId, data, { source: 'mkdir-stdout' }),
      onStderr: (data) => log.videoRenderer.debug(reqId, data, { source: 'mkdir-stderr' })
    });

    // Download slide images in parallel using background processes
    log.videoRenderer.info(reqId, 'Downloading slide images');
    for (const slide of input.slideImages) {
      const slidePath = `/tmp/slides/slide_${slide.slideIndex.toString().padStart(2, '0')}.png`;
      log.videoRenderer.debug(reqId, `Downloading slide ${slide.slideIndex} from ${slide.url}`);

      await sandbox.commands.run(`curl -s -L -o "${slidePath}" "${slide.url}"`, {
        timeoutMs: VIDEO_RENDERING.ASSET_FETCH_TIMEOUT_MS,
        onStdout: (data) => log.videoRenderer.debug(reqId, data, { source: 'curl-stdout' }),
        onStderr: (data) => log.videoRenderer.debug(reqId, data, { source: 'curl-stderr', slideIndex: slide.slideIndex })
      });

      slidePaths.push(slidePath);
      log.videoRenderer.debug(reqId, `Downloaded slide ${slide.slideIndex}`, { path: slidePath });
    }

    // Download audio files
    log.videoRenderer.info(reqId, 'Downloading audio files');
    for (const aud of input.audio) {
      const audioPath = `/tmp/audio/audio_${aud.slideIndex.toString().padStart(2, '0')}.wav`;
      log.videoRenderer.debug(reqId, `Downloading audio ${aud.slideIndex} from ${aud.url}`);

      await sandbox.commands.run(`curl -s -L -o "${audioPath}" "${aud.url}"`, {
        timeoutMs: VIDEO_RENDERING.ASSET_FETCH_TIMEOUT_MS,
        onStdout: (data) => log.videoRenderer.debug(reqId, data, { source: 'curl-stdout' }),
        onStderr: (data) => log.videoRenderer.debug(reqId, data, { source: 'curl-stderr', slideIndex: aud.slideIndex })
      });

      audioPaths.push(audioPath);
      log.videoRenderer.debug(reqId, `Downloaded audio ${aud.slideIndex}`, { path: audioPath });
    }

    log.videoRenderer.info(reqId, 'All assets downloaded successfully', {
      slideCount: slidePaths.length,
      audioCount: audioPaths.length
    });

    return { slidePaths, audioPaths };
  } catch (error) {
    log.videoRenderer.error(reqId, 'Failed to download assets', error as Error);
    throw error;
  }
}

/**
 * Build and execute ffmpeg command for video composition
 * Simplified: zoompan creates video from images, xfade for transitions
 */
async function executeFfmpeg(
  reqId: string,
  sandbox: Sandbox,
  slidePaths: string[],
  audioPaths: string[],
  input: RenderInput
): Promise<string> {
  log.videoRenderer.info(reqId, 'Starting ffmpeg execution', {
    slideCount: slidePaths.length,
    audioCount: audioPaths.length,
    videoType: input.videoType
  });

  const outputPath = '/tmp/output.webm';
  const fps = 25;
  const transitionDuration = 1; // 1 second fade transition

  try {
    // Calculate slide durations (add transition padding)
    const slideDurations = input.audio.map(a => {
      const audioDuration = a.durationMs / 1000;
      const totalDuration = audioDuration + VIDEO_RENDERING.TRANSITION_DURATION_S;
      return totalDuration;
    });
    log.videoRenderer.info(reqId, 'Slide durations calculated', {
      slideDurations,
      audioDurations: input.audio.map(a => a.durationMs / 1000),
      transitionDuration: VIDEO_RENDERING.TRANSITION_DURATION_S,
      totalDuration: slideDurations.reduce((a, b) => a + b, 0).toFixed(2)
    });

    // Resolution based on video type
    const resolution = input.videoType === 'short' ? '1080x1920' : '1920x1080';

    // Build filter complex
    const filters: string[] = [];
    const inputs: string[] = [];

    // Process each slide: zoompan creates video from image with zoom effect
    for (let i = 0; i < slidePaths.length; i++) {
      inputs.push('-i', slidePaths[i]);
      const frames = Math.ceil(slideDurations[i] * fps);
      // Alternate zoom direction: even slides zoom in, odd slides zoom out
      const zoomIn = i % 2 === 0;
      const zoomExpr = zoomIn ? "'min(zoom+0.002,1.2)'" : "'max(zoom-0.002,1.0)'";

      filters.push(
        `[${i}:v]zoompan=z=${zoomExpr}:d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${resolution}:fps=${fps}[v${i}]`
      );
    }

    // Apply xfade transitions between consecutive slides
    // xfade offset = cumulative time up to this point - transition duration
    let currentOffset = 0;
    const xfadeOffsets: { index: number; cumulative: number; offset: number }[] = [];
    for (let i = 1; i < slidePaths.length; i++) {
      // Add previous slide duration to cumulative time
      currentOffset += slideDurations[i - 1];
      // xfade starts transition_duration seconds before current point in timeline
      // Use integer offset to avoid decimal parsing issues
      const offset = Math.round(currentOffset - transitionDuration);
      const prevOutput = i === 1 ? 'v0' : `xf${i - 1}`;
      filters.push(`[${prevOutput}][v${i}]xfade=transition=fade:duration=${transitionDuration}:offset=${offset}[xf${i}]`);
      xfadeOffsets.push({ index: i, cumulative: currentOffset, offset });
    }
    log.videoRenderer.info(reqId, 'Xfade offsets calculated', { offsets: xfadeOffsets });

    // Add audio inputs
    const audioStartIndex = slidePaths.length;
    for (const audioPath of audioPaths) {
      inputs.push('-i', audioPath);
    }
    const audioInputs = audioPaths.map((_, i) => `[${audioStartIndex + i}:a]`).join('');
    filters.push(`${audioInputs}concat=n=${audioPaths.length}:v=0:a=1[outaudio]`);

    // Date badge filter (Japanese format)
    const date = new Date(input.articleDate);
    const dateText = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    const escapedDateText = dateText.replace(/'/g, "''").replace(/:/g, '\\:');
    const dateFilter = `drawtext=text='${escapedDateText}':fontfile=/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc:fontsize=36:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=80`;

    // Add date badge to final video
    const finalVideoTag = slidePaths.length > 1 ? `xf${slidePaths.length - 1}` : 'v0';
    filters.push(`[${finalVideoTag}]${dateFilter}[vout]`);

    // Build filter complex string
    const filterComplex = filters.join(';');
    log.videoRenderer.info(reqId, 'Filter complex', {
      filterCount: filters.length,
      preview: filterComplex.substring(0, 500)
    });

    // Build ffmpeg command
    const ffmpegCommand = [
      'ffmpeg', '-y',
      ...inputs,
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      '-map', '[outaudio]',
      '-c:v', 'libvpx-vp9',
      '-crf', '30',
      '-b:v', '4M',
      '-speed', '2',
      '-tile-columns', '4',
      '-tile-rows', '2',
      '-threads', '4',
      '-c:a', 'libopus',
      '-b:a', '128K',
      '-f', 'webm',
      outputPath
    ];

    const cmdString = ffmpegCommand.join(' ');
    log.videoRenderer.info(reqId, 'Starting ffmpeg', { cmd: cmdString });

    const startTime = Date.now();
    let stderrOutput = '';
    let stdoutOutput = '';

    // Execute with stderr capture for detailed error messages
    try {
      const result = await sandbox.commands.run(cmdString, {
        timeoutMs: VIDEO_RENDERING.FFMPEG_TIMEOUT_MS,
        onStdout: (data) => {
          stdoutOutput += data + '\n';
          log.videoRenderer.info(reqId, 'ffmpeg stdout: ' + data.trim());
        },
        onStderr: (data) => {
          stderrOutput += data + '\n';
          // Log all stderr immediately as info so it appears in Cloudflare Logs
          log.videoRenderer.info(reqId, 'ffmpeg stderr: ' + data.trim());
        }
      });
      log.videoRenderer.info(reqId, 'FFmpeg process completed', {
        exitCode: result.exitCode,
        stdoutLength: stdoutOutput.length,
        stderrLength: stderrOutput.length
      });
    } catch (ffmpegError) {
      const errorMsg = `FFmpeg failed: ${(ffmpegError as Error).message}`;
      // Log full stderr for debugging
      log.videoRenderer.error(reqId, 'FFmpeg stderr output', {
        fullStderr: stderrOutput,
        fullStdout: stdoutOutput
      });
      throw new Error(`${errorMsg}\nStderr: ${stderrOutput.slice(-2000)}`);
    }

    const duration = Date.now() - startTime;
    log.videoRenderer.info(reqId, 'FFmpeg completed', { durationMs: duration });

    // Verify output file
    const checkResult = await sandbox.commands.run(`ls -lh ${outputPath} 2>&1`);
    log.videoRenderer.info(reqId, 'Output check', { output: checkResult.stdout || checkResult.stderr });

    return outputPath;
  } catch (error) {
    log.videoRenderer.error(reqId, 'FFmpeg error', error as Error);
    throw error;
  }
}

/**
 * Calculate video metadata from input and output
 */
function getMetadata(outputPath: string, input: RenderInput): RenderedVideoMetadata {
  const totalAudioDuration = input.audio.reduce((sum, a) => sum + a.durationMs, 0) / 1000;
  const totalDuration = totalAudioDuration + (input.audio.length * VIDEO_RENDERING.TRANSITION_DURATION_S);

  return {
    width: input.videoType === 'short' ? 1080 : 1920,
    height: input.videoType === 'short' ? 1920 : 1080,
    durationMs: Math.round(totalDuration * 1000),
    fps: 25,
    videoCodec: 'VP9',
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
      timeoutMs: 600000 // 10 minutes - for longer videos (up to ~10min output)
    });

    log.videoRenderer.info(reqId, 'E2B sandbox created', {
      sandboxId: sandbox.sandboxId
    });

    // Step 1: Download assets
    log.videoRenderer.info(reqId, 'Step 1/2: Downloading assets to sandbox');
    const { slidePaths, audioPaths } = await downloadAssets(reqId, sandbox, input);

    // Step 2: Build and execute ffmpeg command
    log.videoRenderer.info(reqId, 'Step 2/2: Rendering video with optimized ffmpeg');
    const outputPath = await executeFfmpeg(reqId, sandbox, slidePaths, audioPaths, input);

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
