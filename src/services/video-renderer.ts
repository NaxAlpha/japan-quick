/**
 * Video Renderer Service
 * Uses e2b sandbox with Remotion to render videos from slide images and audio
 * Remotion project is pre-bundled in E2B template, uses remotion render CLI
 */

import type { VideoScript, VideoType, RenderedVideoMetadata, ImageModelId } from '../types/video.js';
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
  imageModel?: ImageModelId; // Image model used for generating slide images
  r2Bucket?: any; // R2 bucket binding for direct upload
  r2Key?: string; // R2 key for upload
}

interface RenderOutput {
  r2Key?: string;  // R2 key where video was uploaded (if r2Bucket provided)
  fileSize?: number;  // File size in bytes
  metadata: RenderedVideoMetadata & { fileSize?: number };
}

/**
 * Pre-download all assets (images and audio) to Remotion's public directory
 * Per Remotion docs: files in public/ are accessible during render via their filename
 * Reference: https://www.remotion.dev/docs/assets
 */
async function downloadAssetsToSandbox(
  reqId: string,
  sandbox: Sandbox,
  slideImages: SlideImageAsset[],
  audio: AudioAsset[]
): Promise<{ imageMap: Map<number, string>; audioMap: Map<number, string> }> {
  log.videoRenderer.info(reqId, 'Pre-downloading assets to Remotion public directory', {
    imageCount: slideImages.length,
    audioCount: audio.length
  });

  const imageMap = new Map<number, string>();
  const audioMap = new Map<number, string>();

  // Ensure public/ directory exists
  await sandbox.commands.run('mkdir -p /home/user/remotion/public');
  log.videoRenderer.debug(reqId, 'Created public directory');

  // Download all assets in parallel (faster than sequential)
  const downloadPromises: Promise<void>[] = [];

  // Queue all image downloads
  for (const image of slideImages) {
    const filename = `slide-${image.slideIndex}.png`;
    const filePath = `/home/user/remotion/public/${filename}`;

    const promise = (async () => {
      log.videoRenderer.debug(reqId, `Downloading image ${image.slideIndex}`, { url: image.url });

      const downloadCmd = `curl -sS --max-time 60 -o "${filePath}" "${image.url}"`;
      const result = await sandbox.commands.run(downloadCmd, { timeoutMs: 90000 });

      if (result.exitCode !== 0) {
        throw new Error(`Failed to download image ${image.slideIndex}: ${result.stderr}`);
      }

      imageMap.set(image.slideIndex, filename);
    })();

    downloadPromises.push(promise);
  }

  // Queue all audio downloads
  for (const aud of audio) {
    const filename = `audio-${aud.slideIndex}.wav`;
    const filePath = `/home/user/remotion/public/${filename}`;

    const promise = (async () => {
      log.videoRenderer.debug(reqId, `Downloading audio ${aud.slideIndex}`, { url: aud.url });

      const downloadCmd = `curl -sS --max-time 60 -o "${filePath}" "${aud.url}"`;
      const result = await sandbox.commands.run(downloadCmd, { timeoutMs: 90000 });

      if (result.exitCode !== 0) {
        throw new Error(`Failed to download audio ${aud.slideIndex}: ${result.stderr}`);
      }

      audioMap.set(aud.slideIndex, filename);
    })();

    downloadPromises.push(promise);
  }

  // Wait for all downloads to complete in parallel
  await Promise.all(downloadPromises);

  log.videoRenderer.info(reqId, 'All assets downloaded to public directory', {
    images: imageMap.size,
    audio: audioMap.size
  });

  // Convert PNG images to JPEG at 90% quality for memory efficiency
  // ffmpeg q:v 2 = ~90% quality (higher number = lower quality)
  log.videoRenderer.info(reqId, 'Converting PNG images to JPEG at 90% quality');
  const convertPromises = slideImages.map(async (image) => {
    const pngFilename = `slide-${image.slideIndex}.png`;
    const jpgFilename = `slide-${image.slideIndex}.jpg`;
    const pngPath = `/home/user/remotion/public/${pngFilename}`;
    const jpgPath = `/home/user/remotion/public/${jpgFilename}`;

    const convertCmd = `ffmpeg -y -i "${pngPath}" -q:v 2 "${jpgPath}" && rm "${pngPath}"`;
    const result = await sandbox.commands.run(convertCmd, { timeoutMs: 30000 });

    if (result.exitCode !== 0) {
      throw new Error(`Failed to convert image ${image.slideIndex}: ${result.stderr}`);
    }

    // Update imageMap to use JPEG filename
    imageMap.set(image.slideIndex, jpgFilename);
  });

  await Promise.all(convertPromises);

  log.videoRenderer.info(reqId, 'All images converted to JPEG', {
    count: slideImages.length
  });

  return { imageMap, audioMap };
}

/**
 * Build inputProps JSON for Remotion and write to sandbox
 * Uses local filenames from public/ directory (pre-downloaded assets)
 */
async function writeRemotionInputProps(
  reqId: string,
  sandbox: Sandbox,
  input: RenderInput,
  imageMap: Map<number, string>,
  audioMap: Map<number, string>
): Promise<string> {
  log.videoRenderer.info(reqId, 'Building Remotion inputProps with local files', {
    slideCount: input.slideImages.length,
    audioCount: input.audio.length
  });

  // Build slides array for Remotion with local filenames
  const slides = input.audio.map((audio) => {
    const imageFile = imageMap.get(audio.slideIndex);
    const audioFile = audioMap.get(audio.slideIndex);

    if (!imageFile) {
      throw new Error(`No image file found for slideIndex ${audio.slideIndex}`);
    }
    if (!audioFile) {
      throw new Error(`No audio file found for slideIndex ${audio.slideIndex}`);
    }

    const slide = input.script.slides[audio.slideIndex];
    if (!slide) {
      throw new Error(`No script slide found for slideIndex ${audio.slideIndex}`);
    }

    // Convert duration to frames at 30 FPS
    // Add 30 frames (1 second) of padding: 15 frames silence at start, 15 at end
    const audioFrames = Math.ceil((audio.durationMs / 1000) * 30);
    const durationInFrames = audioFrames + 30; // Add padding for transitions

    return {
      imageUrl: imageFile,  // Local filename from public/ (e.g., "slide-0.png")
      audioUrl: audioFile,  // Local filename from public/ (e.g., "audio-0.wav")
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
  // Determine resolution based on image model
  // 1080p default, only scale down for non-pro model
  const isNonProModel = input.imageModel === 'gemini-2.5-flash-image';
  const scaleFactor = isNonProModel ? 0.667 : 1.0;  // Non-pro=720p, Everything else=1080p
  const resolution = isNonProModel ? '720p (non-pro model)' : '1080p (default)';

  log.videoRenderer.info(reqId, `Starting Remotion render at ${resolution}`, {
    videoType: input.videoType,
    slideCount: input.slideImages.length,
    imageModel: input.imageModel || 'not specified'
  });

  // Use MP4 output with H.264 codec
  const outputPath = '/tmp/output.mp4';

  // Resolution and dimensions based on video type AND model
  const baseWidth = input.videoType === 'short' ? 1080 : 1920;
  const baseHeight = input.videoType === 'short' ? 1920 : 1080;
  const width = Math.round(baseWidth * scaleFactor);
  const height = Math.round(baseHeight * scaleFactor);

  // Calculate total duration in frames (30 FPS)
  // IMPORTANT: Sum individual slide calculations to avoid rounding discrepancies
  // Each slide: Math.ceil((audioMs / 1000) * 30) + 30 frames padding
  // Total: Must equal sum of all individual durationInFrames
  const totalDurationMs = input.audio.reduce((sum, a) => sum + a.durationMs, 0);
  const totalFrames = input.audio.reduce((sum, a) => {
    const audioFrames = Math.ceil((a.durationMs / 1000) * 30);
    return sum + audioFrames + 30; // audio frames + 30 frames padding
  }, 0);

  // Build remotion render command optimized for output with chunking
  const remotionCommand = [
    'cd /home/user/remotion &&',
    'bunx remotion render',
    'DynamicVideo',
    outputPath,
    '--props', inputPropsPath,
    '--overwrite',
    '--codec', 'h264',                    // H.264 for better compatibility
    '--audio-codec', 'aac',               // AAC audio codec
    '--scale', scaleFactor.toString(),   // Scale based on model (1.0 for pro, 0.667 for non-pro)
    '--concurrency', '1',                 // Single thread to avoid Chrome crashes
    '--gl', 'swangle',                     // Software renderer (stable for long renders)
    '--disallow-parallel-encoding',       // Memory-efficient: don't render+encode simultaneously
    '--media-cache-size-in-bytes', '536870912',   // 512MB media cache
    '--offthreadvideo-cache-size-in-bytes', '536870912',  // 512MB offthread cache
    '--offthreadvideo-video-threads', '1',         // Single thread for video processing
    '--log', 'verbose',                    // Verbose logging for debugging
    '--delay-render-timeout-in-milliseconds', '300000'  // 5 minute timeout for slow asset downloads from R2
  ].join(' ');

  // Debug: Log detailed frame calculation
  const frameCalculation = input.audio.map((a, i) => {
    const audioFrames = Math.ceil((a.durationMs / 1000) * 30);
    return { slideIndex: i, audioMs: a.durationMs, audioFrames, paddingFrames: 30, totalFrames: audioFrames + 30 };
  });

  log.videoRenderer.info(reqId, 'Frame calculation', {
    totalFrames,
    totalDurationMs,
    expectedSeconds: (totalFrames / 30).toFixed(2),
    slideBreakdown: frameCalculation
  });

  log.videoRenderer.info(reqId, 'Remotion command', {
    cmd: remotionCommand,
    width,
    height,
    totalFrames,
    totalDurationMs,
    resolution: `${resolution} with JPEG 90% quality, chunked transfer`,
    imageModel: input.imageModel
  });

  const startTime = Date.now();
  let stdoutOutput = '';
  let stderrOutput = '';

  try {
    const result = await sandbox.commands.run(remotionCommand, {
      timeoutMs: 0, // Disable timeout - let render run as long as needed
      onStdout: (data) => {
        const line = typeof data === 'string' ? data : String(data ?? '');
        if (!line) {
          return;
        }

        stdoutOutput += line + '\n';
        // Log progress updates (frame counts)
        const frameMatch = line.trim().match(/Rendered\s+(\d+)\/(\d+)/);
        if (frameMatch) {
          const current = parseInt(frameMatch[1]);
          const total = parseInt(frameMatch[2]);
          const progress = ((current / total) * 100).toFixed(1);
          log.videoRenderer.info(reqId, `Render progress: ${current}/${total} (${progress}%)`);
        }
      },
      onStderr: (data) => {
        const line = typeof data === 'string' ? data : String(data ?? '');
        if (!line) {
          return;
        }

        stderrOutput += line + '\n';
        // Log errors immediately
        if (line.includes('ERROR') || line.includes('Failed') || line.includes('failed')) {
          log.videoRenderer.error(reqId, 'Remotion stderr error: ' + line.trim());
        } else {
          log.videoRenderer.debug(reqId, 'remotion stderr: ' + line.trim());
        }
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
      fullStderr: stderrOutput.slice(-5000), // Last 5000 chars of stderr
      fullStdout: stdoutOutput.slice(-1000), // Last 1000 chars of stdout
    });
    throw new Error(`${errorMsg}\nStderr: ${stderrOutput.slice(-2000)}`);
  }

  const duration = Date.now() - startTime;
  log.videoRenderer.info(reqId, 'Remotion render completed', {
    durationMs: duration,
    durationMinutes: (duration / 60000).toFixed(2)
  });

  // Verify output file exists and get size
  const checkResult = await sandbox.commands.run(`ls -lh ${outputPath} 2>&1`);
  log.videoRenderer.info(reqId, 'Output check', { output: checkResult.stdout || checkResult.stderr });

  return outputPath;
}

/**
 * Calculate video metadata from input and output
 */
function getMetadata(outputPath: string, input: RenderInput): RenderedVideoMetadata {
  // Total duration = sum of all audio + 1 second padding per slide for transitions
  const totalAudioDuration = input.audio.reduce((sum, a) => sum + a.durationMs, 0) / 1000;
  const paddingDuration = input.audio.length * 1; // 1 second padding per slide
  const totalDuration = totalAudioDuration + paddingDuration;

  // Resolution based on image model
  const isProModel = input.imageModel === 'gemini-3-pro-image-preview';
  const scaleFactor = isProModel ? 1.0 : 0.667;  // 1080p for pro, 720p for non-pro

  return {
    width: input.videoType === 'short' ? Math.round(1080 * scaleFactor) : Math.round(1920 * scaleFactor),
    height: input.videoType === 'short' ? Math.round(1920 * scaleFactor) : Math.round(1080 * scaleFactor),
    durationMs: Math.round(totalDuration * 1000),
    fps: 30, // Remotion uses 30 FPS
    videoCodec: 'H.264',
    audioCodec: 'AAC',
    format: 'mp4'
  };
}

/**
 * Get video metadata with actual file size from ffprobe
 */
async function getMetadataWithSize(
  reqId: string,
  sandbox: Sandbox,
  outputPath: string,
  input: RenderInput
): Promise<RenderedVideoMetadata & { fileSize: number }> {
  // Total duration = sum of all audio + 1 second padding per slide for transitions
  const totalAudioDuration = input.audio.reduce((sum, a) => sum + a.durationMs, 0) / 1000;
  const paddingDuration = input.audio.length * 1; // 1 second padding per slide
  const totalDuration = totalAudioDuration + paddingDuration;

  // Get file size and metadata from ffprobe
  const ffprobeResult = await sandbox.commands.run(
    `ffprobe -v error -show_entries format=size:stream=codec_name,width,height -of json ${outputPath}`
  );

  const ffprobeData = JSON.parse(ffprobeResult.stdout || '{}');
  const fileSize = parseInt(ffprobeData.format?.size || '0');

  // Resolution based on image model
  const isProModel = input.imageModel === 'gemini-3-pro-image-preview';
  const scaleFactor = isProModel ? 1.0 : 0.667;  // 1080p for pro, 720p for non-pro

  return {
    width: input.videoType === 'short' ? Math.round(1080 * scaleFactor) : Math.round(1920 * scaleFactor),
    height: input.videoType === 'short' ? Math.round(1920 * scaleFactor) : Math.round(1080 * scaleFactor),
    durationMs: Math.round(totalDuration * 1000),
    fps: 30,
    videoCodec: 'H.264',
    audioCodec: 'AAC',
    format: 'mp4',
    fileSize
  };
}

/**
 * Main render function using e2b sandbox
 * @param reqId - Request ID for logging
 * @param e2bApiKey - E2B API key
 * @param input - Render input with script, images, audio, r2Bucket, r2Key
 * @returns R2 key and metadata (video uploaded directly to R2)
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
      timeoutMs: 2400000 // 40 minutes - allow extra time for long renders with network overhead
    });

    log.videoRenderer.info(reqId, 'E2B sandbox created', {
      sandboxId: sandbox.sandboxId
    });

    // Step 1: Download all assets to Remotion's public/ directory
    log.videoRenderer.info(reqId, 'Step 1/3: Downloading assets to public directory');
    const { imageMap, audioMap } = await downloadAssetsToSandbox(
      reqId,
      sandbox,
      input.slideImages,
      input.audio
    );

    // Step 2: Write inputProps JSON for Remotion with local filenames
    log.videoRenderer.info(reqId, 'Step 2/3: Writing inputProps with local files');
    const inputPropsPath = await writeRemotionInputProps(reqId, sandbox, input, imageMap, audioMap);

    // Step 3: Execute Remotion render
    log.videoRenderer.info(reqId, 'Step 3/3: Rendering video with Remotion');
    const outputPath = await executeRemotion(reqId, sandbox, inputPropsPath, input);

    // Step 4: Verify output video is valid using ffprobe
    log.videoRenderer.info(reqId, 'Step 4/5: Verifying output with ffprobe');
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

    // Get video metadata (including actual file size)
    const metadata = await getMetadataWithSize(reqId, sandbox, outputPath, input);

    // Step 5: Upload video directly to R2 (if bucket provided)
    const fileSize = metadata.fileSize;
    const fileSizeMB = fileSize / 1024 / 1024;

    log.videoRenderer.info(reqId, 'Step 5/5: Uploading video to R2', {
      fileSizeMB: fileSizeMB.toFixed(2),
      resolution: `${metadata.width}x${metadata.height}`,
      hasR2Bucket: !!input.r2Bucket,
      r2Key: input.r2Key
    });

    if (!input.r2Bucket || !input.r2Key) {
      log.videoRenderer.info(reqId, 'No R2 bucket provided, returning metadata only');
      return { metadata };
    }

    // For small files (< 25MB), single upload
    // For larger files, use chunked multipart upload
    const SINGLE_FILE_THRESHOLD = 25 * 1024 * 1024; // 25MB

    if (fileSize < SINGLE_FILE_THRESHOLD) {
      log.videoRenderer.info(reqId, 'Small file detected, using single upload');
      const fileContentRaw = await sandbox.files.read(outputPath);
      const fileBytes = fileContentRaw instanceof Uint8Array
        ? fileContentRaw
        : new Uint8Array(fileContentRaw);

      log.videoRenderer.info(reqId, 'Uploading to R2', {
        byteLength: fileBytes.byteLength,
        fileSizeMB: fileSizeMB.toFixed(2)
      });

      await input.r2Bucket.put(input.r2Key, fileBytes, {
        customMetadata: {
          contentType: 'video/mp4'
        },
        httpMetadata: {
          contentType: 'video/mp4'
        }
      });

      log.videoRenderer.info(reqId, 'Single file upload complete', {
        r2Key: input.r2Key,
        fileSize
      });

      return { r2Key: input.r2Key, fileSize, metadata };
    }

    // Large file: Chunked multipart upload
    const CHUNK_SIZE = 15 * 1024 * 1024; // 15MB chunks
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

    log.videoRenderer.info(reqId, 'Large file detected, using chunked multipart upload', {
      fileSizeMB: fileSizeMB.toFixed(2),
      chunkCount: totalChunks,
      chunkSizeMB: (CHUNK_SIZE / 1024 / 1024).toFixed(2)
    });

    // Create multipart upload
    const multipartUpload = await input.r2Bucket.createMultipartUpload(input.r2Key, {
      customMetadata: {
        contentType: 'video/mp4'
      },
      httpMetadata: {
        contentType: 'video/mp4'
      }
    });

    const uploadId = multipartUpload.uploadId;
    log.videoRenderer.info(reqId, 'Multipart upload created', { uploadId, r2Key: input.r2Key });

    const uploadedParts: Array<{ partNumber: number; etag: string }> = [];

    // Process chunks ONE AT A TIME - read, upload, discard
    for (let i = 0; i < totalChunks; i++) {
      const offset = i * CHUNK_SIZE;
      const remainingBytes = fileSize - offset;
      const chunkSize = Math.min(CHUNK_SIZE, remainingBytes);
      const partNumber = i + 1;

      log.videoRenderer.info(reqId, `Processing chunk ${partNumber}/${totalChunks}`, {
        chunkSizeMB: (chunkSize / 1024 / 1024).toFixed(2)
      });

      // Use dd to extract chunk from file
      const chunkCmd = `dd if=${outputPath} bs=1 skip=${offset} count=${chunkSize} 2>/dev/null | base64`;
      const chunkResult = await sandbox.commands.run(chunkCmd, { timeoutMs: 120000 });

      if (chunkResult.exitCode !== 0) {
        throw new Error(`Failed to read chunk ${partNumber}: ${chunkResult.stderr}`);
      }

      const chunkBase64 = chunkResult.stdout?.trim() || '';

      // Convert chunk base64 to bytes (only this chunk in memory)
      const chunkBytes = Buffer.from(chunkBase64, 'base64');

      log.videoRenderer.info(reqId, `Uploading chunk ${partNumber}/${totalChunks}`, {
        chunkSizeMB: (chunkSize / 1024 / 1024).toFixed(2),
        base64SizeMB: (chunkBase64.length / 1024 / 1024).toFixed(2)
      });

      // Upload this part
      const uploadedPart = await multipartUpload.uploadPart(partNumber, chunkBytes);
      uploadedParts.push({ partNumber, etag: uploadedPart.etag });

      log.videoRenderer.info(reqId, `Chunk ${partNumber} uploaded`, {
        etag: uploadedPart.etag
      });

      // chunkBytes goes out of scope here - garbage collected
    }

    // Complete multipart upload
    log.videoRenderer.info(reqId, 'Completing multipart upload', {
      partCount: uploadedParts.length,
      fileSizeMB: fileSizeMB.toFixed(2)
    });

    const object = await multipartUpload.complete(uploadedParts);

    log.videoRenderer.info(reqId, 'Multipart upload complete', {
      httpEtag: object.httpEtag,
      r2Key: input.r2Key,
      fileSize
    });

    return { r2Key: input.r2Key, fileSize, metadata };
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
