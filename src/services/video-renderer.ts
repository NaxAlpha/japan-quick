/**
 * Video Renderer Service
 * Uses Cloudflare Sandbox with ffmpeg to render videos from grid images and audio
 */

import type { VideoScript, VideoType, RenderedVideoMetadata } from '../types/video.js';
import { log } from '../lib/logger.js';
import { getSandbox, type Sandbox } from '@cloudflare/sandbox';

interface GridAsset {
  url: string;  // Public URL to download from
  gridIndex: number;
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
}

interface AudioAsset {
  url: string;  // Public URL to download from
  slideIndex: number;
  durationMs: number;
}

interface RenderInput {
  script: VideoScript;
  videoType: VideoType;
  grids: GridAsset[];
  audio: AudioAsset[];
  articleDate: string; // ISO date string for date badge
}

interface RenderOutput {
  videoBase64: string;
  metadata: RenderedVideoMetadata;
}

async function writeAssets(
  reqId: string,
  session: any,
  input: RenderInput
): Promise<void> {
  log.videoRenderer.debug(reqId, 'Writing assets to sandbox', {
    gridCount: input.grids.length,
    audioCount: input.audio.length
  });

  // Helper to extract auth from URL and build headers
  const fetchWithAuth = async (url: string) => {
    const urlObj = new URL(url);
    const headers: HeadersInit = {};

    // Extract credentials if present in URL
    if (urlObj.username && urlObj.password) {
      const credentials = btoa(`${urlObj.username}:${urlObj.password}`);
      headers['Authorization'] = `Basic ${credentials}`;
      // Remove credentials from URL
      urlObj.username = '';
      urlObj.password = '';
    }

    return fetch(urlObj.toString(), {
      headers,
      signal: AbortSignal.timeout(30000)
    });
  };

  try {
    // Create directories
    log.videoRenderer.debug(reqId, 'Creating directories');
    const mkdirResult = await session.exec('mkdir -p grids audio slides');
    if (!mkdirResult.success) {
      throw new Error(`Failed to create directories: ${mkdirResult.stderr}`);
    }
    log.videoRenderer.debug(reqId, 'Directories created');

    // Write grid images
    for (const grid of input.grids) {
      const gridPath = `grids/grid_${grid.gridIndex.toString().padStart(2, '0')}.png`;
      log.videoRenderer.debug(reqId, `Fetching grid ${grid.gridIndex} from ${grid.url}`);

      const response = await fetchWithAuth(grid.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch grid ${grid.gridIndex}: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      log.videoRenderer.debug(reqId, `Grid ${grid.gridIndex} fetched, size: ${arrayBuffer.byteLength} bytes`);

      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      await session.writeFile(gridPath, base64, { encoding: 'base64' });
      log.videoRenderer.debug(reqId, `Wrote grid ${grid.gridIndex} to ${gridPath}`);
    }

    // Write audio files
    for (const aud of input.audio) {
      const audioPath = `audio/audio_${aud.slideIndex.toString().padStart(2, '0')}.wav`;
      log.videoRenderer.debug(reqId, `Fetching audio ${aud.slideIndex} from ${aud.url}`);

      const response = await fetchWithAuth(aud.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio ${aud.slideIndex}: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      log.videoRenderer.debug(reqId, `Audio ${aud.slideIndex} fetched, size: ${arrayBuffer.byteLength} bytes`);

      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      await session.writeFile(audioPath, base64, { encoding: 'base64' });
      log.videoRenderer.debug(reqId, `Wrote audio ${aud.slideIndex} to ${audioPath}`);
    }

    log.videoRenderer.debug(reqId, 'All assets written successfully');
  } catch (error) {
    log.videoRenderer.error(reqId, 'Failed to write assets', error as Error);
    throw error;
  }
}

async function extractSlides(
  reqId: string,
  session: any,
  input: RenderInput
): Promise<string[]> {
  log.videoRenderer.debug(reqId, 'Extracting slides from grids', {
    slideCount: input.script.slides.length
  });

  const slidePaths: string[] = [];
  const slidesPerGrid = 9;

  try {
    for (let i = 0; i < input.script.slides.length; i++) {
      const gridIndex = Math.floor(i / slidesPerGrid);
      const cellIndex = i % slidesPerGrid;

      const grid = input.grids[gridIndex];
      if (!grid) {
        throw new Error(`Grid ${gridIndex} not found for slide ${i}`);
      }

      const row = Math.floor(cellIndex / 3);
      const col = cellIndex % 3;
      const x = col * grid.cellWidth;
      const y = row * grid.cellHeight;

      const inputPath = `grids/grid_${gridIndex.toString().padStart(2, '0')}.png`;
      const outputPath = `slides/slide_${i.toString().padStart(2, '0')}.png`;

      log.videoRenderer.debug(reqId, `Extracting slide ${i} from grid ${gridIndex}`, {
        cellIndex,
        crop: `${grid.cellWidth}:${grid.cellHeight}:${x}:${y}`
      });

      const result = await session.exec(
        `ffmpeg -y -i ${inputPath} -vf crop=${grid.cellWidth}:${grid.cellHeight}:${x}:${y} ${outputPath}`,
        { timeoutMs: 30000 }
      );

      if (!result.success) {
        log.videoRenderer.error(reqId, `Failed to extract slide ${i}`, new Error(result.stderr || 'Unknown error'));
        throw new Error(`Failed to extract slide ${i}: ${result.stderr}`);
      }

      slidePaths.push(outputPath);
      log.videoRenderer.debug(reqId, `Slide ${i} extracted successfully`);
    }

    log.videoRenderer.debug(reqId, 'All slides extracted', { count: slidePaths.length });
    return slidePaths;
  } catch (error) {
    log.videoRenderer.error(reqId, 'Failed to extract slides', error as Error);
    throw error;
  }
}

async function executeFfmpeg(
  reqId: string,
  session: any,
  slidePaths: string[],
  input: RenderInput
): Promise<string> {
  log.videoRenderer.info(reqId, 'Starting ffmpeg execution', {
    slideCount: slidePaths.length,
    videoType: input.videoType
  });

  const outputPath = 'output.webm';
  const fps = 25;

  try {
    // Calculate slide durations with 0.5s padding on each end
    const slideDurations = input.audio.map(a => (a.durationMs / 1000) + 1.0); // 0.5s + audio + 0.5s
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
    filters.push(`[0:v]zoompan=z='min(1.2,zoom+0.002)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=${fps}:s=${resolution}[v0]`);
    inputs.push('-i', slidePaths[0]);

    // Process subsequent slides
    for (let i = 1; i < slidePaths.length; i++) {
      // Add input
      inputs.push('-i', slidePaths[i]);

      // Apply zoompan to current slide
      const zoomDir = i % 2 === 0 ? '+' : '-';
      const zoomFormula = zoomDir === '+' ? 'min(1.2,zoom+0.002)' : 'max(1.0,zoom-0.002)';
      filters.push(`[${i}:v]zoompan=z='${zoomFormula}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=${fps}:s=${resolution}[v${i}]`);

      // Calculate offset for xfade (0.5s before current slide ends in timeline)
      const prevSlideEndTime = cumulativeTimes[i];
      const offset = prevSlideEndTime - 0.5;

      // Apply xfade with previous output
      const prevOutput = i === 1 ? 'v0' : `xf${i - 1}`;
      filters.push(`[${prevOutput}][v${i}]xfade=transition=fade:duration=1:offset=${offset}[xf${i}]`);
    }

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
      '-c:v', 'libvpx-vp9',
      '-crf', '30',
      '-b:v', '2M',
      '-f', 'webm',
      outputPath
    ].join(' ');

    log.videoRenderer.info(reqId, 'Starting ffmpeg render', {
      commandLength: ffmpegCommand.length,
      timeout: 300000
    });

    const startTime = Date.now();
    const result = await session.exec(ffmpegCommand, { timeoutMs: 300000 });
    const duration = Date.now() - startTime;

    log.videoRenderer.info(reqId, 'FFmpeg execution completed', {
      success: result.success,
      durationMs: duration,
      stdoutLength: result.stdout?.length || 0,
      stderrLength: result.stderr?.length || 0
    });

    if (!result.success) {
      const stderr = result.stderr ?? '';
      log.videoRenderer.error(reqId, 'FFmpeg failed', new Error(stderr), {
        command: ffmpegCommand.substring(0, 500),
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

function getMetadata(workspaceId: string, outputPath: string, input: RenderInput): RenderedVideoMetadata {
  // Calculate total duration from audio + padding
  const totalAudioDuration = input.audio.reduce((sum, a) => sum + a.durationMs, 0) / 1000;
  const totalDuration = totalAudioDuration + (input.audio.length * 1.0); // 1s padding per slide

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
    gridCount: input.grids.length,
    audioCount: input.audio.length
  });

  let session: any = null;

  try {
    // Create a single session to reuse for all operations
    // Using a session with a working directory avoids path issues
    // and provides consistent state across all operations
    log.videoRenderer.debug(reqId, 'Creating sandbox session');

    // Retry session creation with exponential backoff
    let retries = 3;
    let delay = 2000; // Start with 2 second delay

    while (retries > 0) {
      try {
        session = await sandbox.createSession({
          cwd: '/workspace'
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

    // Write assets using the session
    log.videoRenderer.info(reqId, 'Step 1/4: Writing assets to sandbox');
    await writeAssets(reqId, session, input);

    // Extract slides using the session
    log.videoRenderer.info(reqId, 'Step 2/4: Extracting slides from grids');
    const slidePaths = await extractSlides(reqId, session, input);

    // Build and execute ffmpeg command using the session
    log.videoRenderer.info(reqId, 'Step 3/4: Rendering video with ffmpeg');
    const outputPath = await executeFfmpeg(reqId, session, slidePaths, input);

    // Read output video using session
    log.videoRenderer.info(reqId, 'Step 4/4: Reading output video');
    const readResult = await session.readFile('output.webm', { encoding: 'base64' });
    const videoData = typeof readResult === 'string' ? readResult : readResult.content;
    log.videoRenderer.debug(reqId, 'Output video read', {
      base64Length: videoData.length,
      estimatedSizeMB: (videoData.length * 0.75 / 1024 / 1024).toFixed(2)
    });

    // Get video metadata
    const metadata = getMetadata('', 'output.webm', input);

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
