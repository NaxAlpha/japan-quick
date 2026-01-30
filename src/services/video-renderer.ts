/**
 * Video Renderer Service
 * Uses Cloudflare Sandbox with ffmpeg to render videos from individual slide images and audio
 */

import type { VideoScript, VideoType, RenderedVideoMetadata } from '../types/video.js';
import { log } from '../lib/logger.js';
import { getSandbox, type Sandbox, type Session } from '@cloudflare/sandbox';
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
  videoBase64: string;
  metadata: RenderedVideoMetadata;
}

async function writeAssets(
  reqId: string,
  session: Session,
  input: RenderInput
): Promise<{ slidePaths: string[]; audioPaths: string[] }> {
  log.videoRenderer.debug(reqId, 'Writing assets to sandbox', {
    slideImageCount: input.slideImages.length,
    audioCount: input.audio.length
  });

  const slidePaths: string[] = [];
  const audioPaths: string[] = [];

  try {
    // Create directories
    log.videoRenderer.debug(reqId, 'Creating directories');
    const mkdirResult = await session.exec('mkdir -p slides audio');
    if (!mkdirResult.success) {
      throw new Error(`Failed to create directories: ${mkdirResult.stderr}`);
    }
    log.videoRenderer.debug(reqId, 'Directories created');

    // Download slide images using curl inside sandbox
    for (const slide of input.slideImages) {
      const slidePath = `slides/slide_${slide.slideIndex.toString().padStart(2, '0')}.png`;
      log.videoRenderer.debug(reqId, `Downloading slide ${slide.slideIndex} from ${slide.url}`);

      // Use curl to download directly inside the sandbox
      const curlResult = await session.exec(
        `curl -v -L -o "${slidePath}" "${slide.url}"`,
        { timeoutMs: VIDEO_RENDERING.ASSET_FETCH_TIMEOUT_MS }
      );

      if (!curlResult.success) {
        log.videoRenderer.error(reqId, `Failed to download slide ${slide.slideIndex}`, undefined, {
          stderr: curlResult.stderr,
          stdout: curlResult.stdout?.slice(0, 500),
          url: slide.url
        });
        throw new Error(`Failed to download slide ${slide.slideIndex}: ${curlResult.stderr}`);
      }

      slidePaths.push(slidePath);
      log.videoRenderer.debug(reqId, `Downloaded slide ${slide.slideIndex}`, {
        path: slidePath,
        stdoutLength: curlResult.stdout?.length || 0,
        stderrLength: curlResult.stderr?.length || 0
      });
    }

    // Download audio files using curl inside sandbox
    for (const aud of input.audio) {
      const audioPath = `audio/audio_${aud.slideIndex.toString().padStart(2, '0')}.wav`;
      log.videoRenderer.debug(reqId, `Downloading audio ${aud.slideIndex} from ${aud.url}`);

      // Use curl to download directly inside the sandbox
      const curlResult = await session.exec(
        `curl -v -L -o "${audioPath}" "${aud.url}"`,
        { timeoutMs: VIDEO_RENDERING.ASSET_FETCH_TIMEOUT_MS }
      );

      if (!curlResult.success) {
        log.videoRenderer.error(reqId, `Failed to download audio ${aud.slideIndex}`, undefined, {
          stderr: curlResult.stderr,
          stdout: curlResult.stdout?.slice(0, 500),
          url: aud.url
        });
        throw new Error(`Failed to download audio ${aud.slideIndex}: ${curlResult.stderr}`);
      }

      audioPaths.push(audioPath);
      log.videoRenderer.debug(reqId, `Downloaded audio ${aud.slideIndex}`, {
        path: audioPath,
        stdoutLength: curlResult.stdout?.length || 0,
        stderrLength: curlResult.stderr?.length || 0
      });
    }

    log.videoRenderer.debug(reqId, 'All assets downloaded successfully', {
      slideCount: slidePaths.length,
      audioCount: audioPaths.length
    });

    return { slidePaths, audioPaths };
  } catch (error) {
    log.videoRenderer.error(reqId, 'Failed to write assets', error as Error);
    throw error;
  }
}

async function executeFfmpeg(
  reqId: string,
  session: Session,
  slidePaths: string[],
  audioPaths: string[],
  input: RenderInput
): Promise<string> {
  log.videoRenderer.info(reqId, 'Starting ffmpeg execution', {
    slideCount: slidePaths.length,
    audioCount: audioPaths.length,
    videoType: input.videoType
  });

  const outputPath = 'output.webm';
  const fps = 25;

  try {
    // Calculate slide durations with 0.5s padding on each end
    const slideDurations = input.audio.map(a => (a.durationMs / 1000) + VIDEO_RENDERING.TRANSITION_DURATION_S);
    log.videoRenderer.debug(reqId, 'Calculated slide durations', {
      durations: slideDurations,
      totalDuration: slideDurations.reduce((a, b) => a + b, 0)
    });

    // Calculate cumulative times for xfade transitions
    // Fade starts 0.5s before slide N ends, overlaps 0.5s into slide N+1
    const cumulativeTimes: number[] = [];
    let totalTime = 0;
    for (const duration of slideDurations) {
      cumulativeTimes.push(totalTime);
      totalTime += duration;
    }
    log.videoRenderer.debug(reqId, 'Calculated cumulative times', { cumulativeTimes });

    // Build filter complex
    const filters: string[] = [];
    const inputs: string[] = [];

    // First slide: zoompan + setpts
    const resolution = input.videoType === 'short' ? '1080x1920' : '1920x1080';
    // Calculate frame count for first slide based on audio duration
    const firstSlideFrames = Math.ceil(slideDurations[0] * fps);
    // Calculate zoom step to zoom from 1.0 to 1.2 over the slide duration
    const firstZoomStep = (0.2 / firstSlideFrames).toFixed(6);
    filters.push(`[0:v]zoompan=z='min(1.2,zoom+${firstZoomStep})':d=${firstSlideFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=${fps}:s=${resolution}[v0]`);
    inputs.push('-i', slidePaths[0]);

    // Process subsequent slides
    for (let i = 1; i < slidePaths.length; i++) {
      // Add input
      inputs.push('-i', slidePaths[i]);

      // Apply zoompan to current slide with frame count from audio duration
      const slideFrames = Math.ceil(slideDurations[i] * fps);
      const zoomStep = (0.2 / slideFrames).toFixed(6);
      const zoomDir = i % 2 === 0 ? '+' : '-';
      const zoomFormula = zoomDir === '+' ? `min(1.2,zoom+${zoomStep})` : `max(1.0,zoom-${zoomStep})`;
      filters.push(`[${i}:v]zoompan=z='${zoomFormula}':d=${slideFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=${fps}:s=${resolution}[v${i}]`);

      // Calculate offset for xfade (0.5s before current slide ends in timeline)
      const prevSlideEndTime = cumulativeTimes[i];
      const offset = prevSlideEndTime - 0.5;

      // Apply xfade with previous output
      const prevOutput = i === 1 ? 'v0' : `xf${i - 1}`;
      filters.push(`[${prevOutput}][v${i}]xfade=transition=fade:duration=1:offset=${offset}[xf${i}]`);
    }

    // Add audio inputs to command BEFORE building the audio filter
    // This allows us to calculate the correct input indices
    const audioStartIndex = slidePaths.length;
    for (const audioPath of audioPaths) {
      inputs.push('-i', audioPath);
    }

    // Build audio concat filter with correct input indices
    const audioInputs = audioPaths.map((_, i) => `[${audioStartIndex + i}:a]`).join('');
    filters.push(`${audioInputs}concat=n=${audioPaths.length}:v=0:a=1[outaudio]`);

    // Date badge filter (Japanese format)
    const date = new Date(input.articleDate);
    const dateText = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    // Escape special characters in drawtext
    const escapedDateText = dateText.replace(/:/g, '\\:').replace(/'/g, "\\'");
    const dateFilter = `drawtext=text='${escapedDateText}':fontfile=/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc:fontsize=36:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=80`;

    // Add date badge to final output
    const finalVideo = `xf${slidePaths.length - 1}`;
    filters.push(`[${finalVideo}]${dateFilter}[vdated]`);

    // Build filter complex string
    const filterComplex = filters.join(';');
    log.videoRenderer.debug(reqId, 'Built filter complex', {
      filterCount: filters.length,
      filterLength: filterComplex.length
    });

    // Build ffmpeg command - properly escape the filter complex
    const ffmpegCommand = [
      'ffmpeg -y',
      ...inputs,
      '-filter_complex', `"${filterComplex}"`,
      '-map', '[vdated]',
      '-map', '[outaudio]',
      '-c:v', 'libvpx-vp9',
      '-crf', '30',
      '-b:v', '2M',
      '-c:a', 'libopus',
      '-b:a', '128K',
      '-f', 'webm',
      outputPath
    ].join(' ');

    log.videoRenderer.info(reqId, 'Starting ffmpeg render', {
      commandLength: ffmpegCommand.length,
      timeout: 300000
    });

    const startTime = Date.now();
    const result = await session.exec(ffmpegCommand, { timeoutMs: VIDEO_RENDERING.FFMPEG_TIMEOUT_MS });
    const duration = Date.now() - startTime;

    log.videoRenderer.info(reqId, 'FFmpeg execution completed', {
      success: result.success,
      durationMs: duration,
      stdoutLength: result.stdout?.length || 0,
      stderrLength: result.stderr?.length || 0
    });

    // Log a sample of ffmpeg stderr output (contains progress info)
    if (result.stderr) {
      const stderrSample = result.stderr.slice(-1000); // Last 1000 chars usually has final stats
      log.videoRenderer.debug(reqId, 'FFmpeg stderr output', {
        sample: stderrSample.replace(/\n/g, '\\n')
      });
    }

    if (!result.success) {
      const stderr = result.stderr ?? '';
      log.videoRenderer.error(reqId, 'FFmpeg failed', undefined, {
        command: ffmpegCommand.substring(0, 500),
        stderr: stderr.slice(0, 2000),
        durationMs: duration
      });
      throw new Error(`FFmpeg failed: ${stderr}`);
    }

    log.videoRenderer.info(reqId, 'FFmpeg render completed successfully', {
      durationMs: duration,
      outputPath
    });

    return outputPath;
  } catch (error) {
    log.videoRenderer.error(reqId, 'FFmpeg execution error', error as Error);
    throw error;
  }
}

function getMetadata(outputPath: string, input: RenderInput): RenderedVideoMetadata {
  // Calculate total duration from audio + padding
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

export async function renderVideo(
  reqId: string,
  sandbox: Sandbox,
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

  // Check for duplicate slide indices
  const slideIndices = new Set(input.slideImages.map(s => s.slideIndex));
  if (slideIndices.size !== input.slideImages.length) {
    throw new Error('Duplicate slide indices detected in slideImages');
  }

  let session: Session | null = null;

  try {
    // Create a single session to reuse for all operations
    // Using a session with a working directory avoids path issues
    // and provides consistent state across all operations
    log.videoRenderer.debug(reqId, 'Creating sandbox session');

    // Retry session creation with exponential backoff
    let retries = 3;
    let delay = VIDEO_RENDERING.SESSION_RETRY_BASE_DELAY_MS;

    while (retries > 0) {
      try {
        session = await sandbox.createSession({
          cwd: '/workspace',
          // Stream sandbox logs to worker logs for debugging
          logs: {
            onLog: (logEntry: { timestamp: number; level: string; message: string }) => {
              const logLevel = logEntry.level?.toLowerCase() || 'info';
              const message = `[Sandbox] ${logEntry.message}`.trim();
              if (logLevel === 'error') {
                log.videoRenderer.error(reqId, message, { source: 'sandbox' });
              } else if (logLevel === 'warn') {
                log.videoRenderer.warn(reqId, message, { source: 'sandbox' });
              } else {
                log.videoRenderer.debug(reqId, message, { source: 'sandbox' });
              }
            }
          }
        });
        log.videoRenderer.debug(reqId, 'Sandbox session created successfully', {
          sessionId: (session as any).id || 'unknown',
          retriesLeft: retries
        });
        break;
      } catch (sessionError) {
        retries--;
        log.videoRenderer.error(reqId, `Failed to create sandbox session (${3 - retries}/3)`, sessionError as Error, {
          errorType: (sessionError as Error).constructor.name,
          errorMessage: (sessionError as Error).message,
          retriesLeft: retries
        });

        if (retries === 0) {
          throw new Error(`Failed to create sandbox session after 3 attempts: ${(sessionError as Error).message}`);
        }

        // Wait before retrying
        log.videoRenderer.debug(reqId, `Waiting ${delay}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }

    if (!session) {
      throw new Error('Failed to create sandbox session');
    }

    // Write assets using the session (downloads via curl)
    log.videoRenderer.info(reqId, 'Step 1/3: Downloading assets to sandbox');
    const { slidePaths, audioPaths } = await writeAssets(reqId, session, input);

    // Build and execute ffmpeg command using the session
    log.videoRenderer.info(reqId, 'Step 2/3: Rendering video with ffmpeg');
    const outputPath = await executeFfmpeg(reqId, session, slidePaths, audioPaths, input);

    // Read output video using session
    log.videoRenderer.info(reqId, 'Step 3/3: Reading output video');
    const readResult = await session.readFile('output.webm', { encoding: 'base64' });
    const videoData = typeof readResult === 'string' ? readResult : readResult.content;
    log.videoRenderer.debug(reqId, 'Output video read', {
      base64Length: videoData.length,
      estimatedSizeMB: (videoData.length * 0.75 / 1024 / 1024).toFixed(2)
    });

    // Get video metadata
    const metadata = getMetadata(outputPath, input);

    log.videoRenderer.info(reqId, 'Video render completed successfully', {
      outputBase64Length: videoData.length,
      estimatedSizeMB: (videoData.length * 0.75 / 1024 / 1024).toFixed(2),
      durationMs: metadata.durationMs,
      resolution: `${metadata.width}x${metadata.height}`
    });

    return {
      videoBase64: videoData,
      metadata
    };
  } catch (error) {
    log.videoRenderer.error(reqId, 'Video render failed', error as Error, {
      errorType: (error as Error).constructor.name,
      errorMessage: (error as Error).message
    });
    throw error;
  }
}
