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

  // Create directories
  await session.exec('mkdir -p grids audio slides');

  // Write grid images
  for (const grid of input.grids) {
    const gridPath = `grids/grid_${grid.gridIndex.toString().padStart(2, '0')}.png`;
    log.videoRenderer.debug(reqId, `Fetching grid ${grid.gridIndex} from ${grid.url}`);

    const response = await fetch(grid.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch grid ${grid.gridIndex}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    await session.writeFile(gridPath, base64, { encoding: 'base64' });
    log.videoRenderer.debug(reqId, `Wrote grid ${grid.gridIndex} to ${gridPath}`);
  }

  // Write audio files
  for (const aud of input.audio) {
    const audioPath = `audio/audio_${aud.slideIndex.toString().padStart(2, '0')}.wav`;
    log.videoRenderer.debug(reqId, `Fetching audio ${aud.slideIndex} from ${aud.url}`);

    const response = await fetch(aud.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio ${aud.slideIndex}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    await session.writeFile(audioPath, base64, { encoding: 'base64' });
    log.videoRenderer.debug(reqId, `Wrote audio ${aud.slideIndex} to ${audioPath}`);
  }

  log.videoRenderer.debug(reqId, 'All assets written successfully');
}

async function extractSlides(
  reqId: string,
  session: any,
  input: RenderInput
): Promise<string[]> {
  log.videoRenderer.debug(reqId, 'Extracting slides from grids');

  const slidePaths: string[] = [];
  const slidesPerGrid = 9;

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

    await session.exec(
      `ffmpeg -y -i ${inputPath} -vf crop=${grid.cellWidth}:${grid.cellHeight}:${x}:${y} ${outputPath}`
    );

    slidePaths.push(outputPath);
  }

  return slidePaths;
}

async function executeFfmpeg(
  reqId: string,
  session: any,
  slidePaths: string[],
  input: RenderInput
): Promise<string> {
  log.videoRenderer.debug(reqId, 'Executing ffmpeg', {
    slideCount: slidePaths.length
  });

  const outputPath = 'output.webm';
  const fps = 25;

  // Calculate slide durations with 0.5s padding on each end
  const slideDurations = input.audio.map(a => (a.durationMs / 1000) + 1.0); // 0.5s + audio + 0.5s

  // Calculate cumulative times for xfade transitions
  // Fade starts 0.5s before slide N ends, overlaps 0.5s into slide N+1
  const cumulativeTimes: number[] = [];
  let totalTime = 0;
  for (const duration of slideDurations) {
    cumulativeTimes.push(totalTime);
    totalTime += duration;
  }

  // Build filter complex
  const filters: string[] = [];
  const inputs: string[] = [];

  // First slide: zoompan + setpts
  filters.push(`[0:v]zoompan=z='min(1.2,zoom+0.002)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=${fps}:s=${input.videoType === 'short' ? '1080x1920' : '1920x1080'}[v0]`);
  inputs.push('-i', slidePaths[0]);

  // Process subsequent slides
  for (let i = 1; i < slidePaths.length; i++) {
    // Add input
    inputs.push('-i', slidePaths[i]);

    // Apply zoompan to current slide
    const zoomDir = i % 2 === 0 ? '+' : '-';
    filters.push(`[${i}:v]zoompan=z='${zoomDir === '+' ? '1.2' : '1.0'}${zoomDir === '+' ? '+0.002' : '-0.002'}*on':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=${fps}:s=${input.videoType === 'short' ? '1080x1920' : '1920x1080'}[v${i}]`);

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
  const dateFilter = `drawtext=text='${dateText}':fontfile=/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc:fontsize=36:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=80`;

  // Add date badge to final output
  const finalVideo = `xf${slidePaths.length - 1}`;
  filters.push(`[${finalVideo}]${dateFilter}[vdated]`);

  // Build ffmpeg command
  const ffmpegCommand = [
    'ffmpeg -y',
    ...inputs,
    '-filter_complex', `'${filters.join(';')}'`,
    '-map', '[vdated]',
    '-c:v', 'libvpx-vp9',
    '-crf', '30',
    '-b:v', '2M',
    '-f', 'webm',
    outputPath
  ].join(' ');

  log.videoRenderer.debug(reqId, 'FFmpeg command', { command: ffmpegCommand });

  const result = await session.exec(ffmpegCommand, { timeoutMs: 300000 });

  if (!result.success) {
    const stderr = result.stderr ?? '';
    log.videoRenderer.error(reqId, 'FFmpeg failed', new Error(stderr));
    throw new Error(`FFmpeg failed: ${stderr}`);
  }

  return outputPath;
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
    videoType: input.videoType
  });

  try {
    // Create a single session to reuse for all operations
    // Using a session with a working directory avoids path issues
    // and provides consistent state across all operations
    const session = await sandbox.createSession({
      id: `render-${reqId}`,
      cwd: '/workspace'
    });

    // Write assets using the session
    await writeAssets(reqId, session, input);

    // Extract slides using the session
    const slidePaths = await extractSlides(reqId, session, input);

    // Build and execute ffmpeg command using the session
    const outputPath = await executeFfmpeg(reqId, session, slidePaths, input);

    // Read output video using session
    const readResult = await session.readFile('output.webm', { encoding: 'base64' });
    const videoData = typeof readResult === 'string' ? readResult : readResult.content;

    // Get video metadata
    const metadata = getMetadata('', 'output.webm', input);

    log.videoRenderer.info(reqId, 'Video render completed', {
      outputSize: videoData.length,
      durationMs: metadata.durationMs
    });

    return {
      videoBase64: videoData,
      metadata
    };
  } catch (error) {
    log.videoRenderer.error(reqId, 'Video render failed', error as Error);
    throw error;
  }
}
