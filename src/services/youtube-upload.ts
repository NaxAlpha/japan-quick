/**
 * YouTube Upload Service
 * Handles video upload to YouTube using the resumable upload API
 */

import { createLogger } from '../lib/logger.js';
import type {
  YouTubeUploadSession,
  YouTubeVideoStatus,
  YouTubeVideoResource,
  YouTubeUploadOptions
} from '../types/youtube.js';
import type { VideoScript, YouTubeInfo } from '../types/video.js';
import { Sandbox } from 'e2b';
import { Image } from 'cross-image';

const log = createLogger('YouTubeUpload');

// Default upload options
const DEFAULT_UPLOAD_OPTIONS: Required<Omit<YouTubeUploadOptions, 'title' | 'description'>> = {
  privacy: 'private',
  tags: ['日本', 'ニュース', 'Japan', 'News'],
  categoryId: '25',
  defaultLanguage: 'ja',
  defaultAudioLanguage: 'ja',
  madeForKids: false,
  selfDeclaredMadeForKids: false,
  containsSyntheticMedia: true,
  notPaidContent: true,
};

// Chunk size for resumable upload (256KB as per YouTube API)
const CHUNK_SIZE = 256 * 1024;

// Polling interval for video processing status
const PROCESSING_POLL_INTERVAL_MS = 5000;

// Maximum polling time for video processing (30 minutes)
const MAX_PROCESSING_TIME_MS = 30 * 60 * 1000;

// Maximum retries for final status query after upload complete
const MAX_STATUS_QUERY_RETRIES = 5;
const STATUS_QUERY_RETRY_DELAY_MS = 2000; // 2 seconds

// YouTube thumbnail constraints
const MAX_THUMBNAIL_SIZE_BYTES = 2 * 1024 * 1024; // 2MB hard limit
const THUMBNAIL_TARGET_SIZES = [
  { width: 1280, height: 720 },
  { width: 1152, height: 648 },
  { width: 1024, height: 576 }
] as const;
const THUMBNAIL_QUALITY_STEPS = [95, 90, 85, 80] as const;

/**
 * YouTube Upload Service Class
 */
export class YouTubeUploadService {
  private accessToken: string;
  private e2bApiKey?: string;

  constructor(accessToken: string, e2bApiKey?: string) {
    this.accessToken = accessToken;
    this.e2bApiKey = e2bApiKey;
  }

  /**
   * Create a resumable upload session
   */
  async createUploadSession(
    reqId: string,
    script: VideoScript,
    options?: Partial<YouTubeUploadOptions>
  ): Promise<YouTubeUploadSession> {
    log.info(reqId, 'Creating YouTube upload session');

    const opts = { ...DEFAULT_UPLOAD_OPTIONS, ...options, title: script.title, description: script.description };

    // Build metadata object for YouTube
    const metadata = {
      snippet: {
        title: opts.title,
        description: opts.description,
        tags: opts.tags,
        categoryId: opts.categoryId,
        defaultLanguage: opts.defaultLanguage,
        defaultAudioLanguage: opts.defaultAudioLanguage,
      },
      status: {
        privacyStatus: opts.privacy,
        selfDeclaredMadeForKids: opts.selfDeclaredMadeForKids,
        madeForKids: opts.madeForKids,
        containsSyntheticMedia: opts.containsSyntheticMedia,
        notPaidContent: opts.notPaidContent,
      },
    };

    log.info(reqId, 'Upload metadata', {
      title: opts.title,
      privacy: opts.privacy,
      categoryId: opts.categoryId,
      tagsCount: opts.tags.length,
    });

    // Initiate resumable upload session
    const response = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status,contentDetails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(errorText) as Error & { status?: number };
      error.status = response.status;
      log.error(reqId, 'Failed to create upload session', error);
      throw new Error(`Failed to create upload session: ${response.status} ${errorText}`);
    }

    const uploadUrl = response.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('No upload URL in response');
    }

    // Extract video ID from upload URL
    const videoIdMatch = uploadUrl.match(/\/videos\/([a-zA-Z0-9_-]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : '';

    log.info(reqId, 'Upload session created', { videoId });

    return { uploadUrl, videoId };
  }

  /**
   * Upload video using E2B sandbox with curl (simpler, more reliable)
   * Downloads video from R2 and uploads to YouTube using curl resumable upload
   * @returns The YouTube video ID when upload completes
   */
  async uploadVideoWithCurl(
    reqId: string,
    uploadUrl: string,
    videoPublicUrl: string,
    videoSizeBytes: number,
    onProgress?: (progress: { bytesUploaded: number; totalBytes: number; percentage: number }) => void
  ): Promise<string> {
    if (!this.e2bApiKey) {
      throw new Error('E2B API key is required for curl-based upload');
    }

    log.info(reqId, 'Starting video upload with E2B + curl', {
      videoSizeBytes,
      videoSizeMB: (videoSizeBytes / 1024 / 1024).toFixed(2),
      videoPublicUrl,
    });

    const sandbox = await Sandbox.create({
      template: 'video-renderer',
      apiKey: this.e2bApiKey,
    });

    try {
      log.info(reqId, 'E2B sandbox created', { sandboxId: sandbox.sandboxId });

      // Step 1: Download video from R2 to sandbox
      log.info(reqId, 'Downloading video from R2 to sandbox');
      const downloadCmd = `curl -sS --max-time 300 -o /home/user/video.mp4 "${videoPublicUrl}"`;
      const downloadResult = await sandbox.commands.run(downloadCmd, { timeoutMs: 360000 });

      if (downloadResult.exitCode !== 0) {
        throw new Error(`Failed to download video from R2: ${downloadResult.stderr || downloadResult.stdout}`);
      }

      // Verify file size
      const sizeCheckResult = await sandbox.commands.run('wc -c < /home/user/video.mp4');
      const downloadedSize = parseInt(sizeCheckResult.stdout.trim(), 10);
      log.info(reqId, 'Video downloaded to sandbox', {
        downloadedSize,
        expectedSize: videoSizeBytes,
      });

      // Step 2: Upload to YouTube using curl with resumable upload
      log.info(reqId, 'Uploading video to YouTube with curl');

      // Build metadata JSON
      const metadataJson = JSON.stringify({
        snippet: {
          title: 'Video', // Will be updated separately
          description: 'Video description',
          categoryId: '25',
          defaultLanguage: 'ja',
        },
        status: {
          privacyStatus: 'private',
          selfDeclaredMadeForKids: false,
          containsSyntheticMedia: true,
        },
      });

      // Create upload script
      // Note: Using $$ to escape $ for bash variables, while ${var} is TypeScript interpolation
      // We already have the uploadUrl, so we can skip the first POST request
      const uploadScript = `#!/bin/bash
set -e

echo "Starting YouTube upload..."

# Upload video file directly to the upload URL
# -s = silent, -i = include response headers
curl -s -i -X PUT \\
  -H "Authorization: Bearer ${this.accessToken}" \\
  -H "Content-Type: video/mp4" \\
  --data-binary @/home/user/video.mp4 \\
  "${uploadUrl}" > /home/user/upload_response.txt

cat /home/user/upload_response.txt
`;

      // Write upload script to sandbox
      await sandbox.files.write('/home/user/upload.sh', uploadScript);

      // Make script executable and run it
      await sandbox.commands.run('chmod +x /home/user/upload.sh');
      const uploadResult = await sandbox.commands.run('/home/user/upload.sh', { timeoutMs: 3600000 });

      log.info(reqId, 'Upload script output', {
        stdout: uploadResult.stdout,
        stderr: uploadResult.stderr,
        exitCode: uploadResult.exitCode,
      });

      if (uploadResult.exitCode !== 0) {
        // Get the full response for debugging
        const responseContent = await sandbox.commands.run('cat /home/user/upload_response.txt');
        throw new Error(`Upload script failed: ${uploadResult.stderr}\nResponse: ${responseContent.stdout}`);
      }

      // Parse response to get video ID
      // YouTube returns JSON with video resource on success
      let videoId: string;
      const responseContent = await sandbox.commands.run('cat /home/user/upload_response.txt');

      log.info(reqId, 'Upload response content', { content: responseContent.stdout.substring(0, 500) });

      try {
        // The response includes headers (from -i flag), so we need to extract the JSON body
        // Look for the JSON after the headers (starts with {)
        const jsonMatch = responseContent.stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonResponse = JSON.parse(jsonMatch[0]);
          videoId = jsonResponse.id;

          if (!videoId) {
            throw new Error('No video ID in response');
          }
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (e) {
        // Fallback: Extract video ID from upload URL
        // The upload URL contains the video ID in the path
        const urlMatch = uploadUrl.match(/\/videos\/([a-zA-Z0-9_-]+)/);
        if (urlMatch) {
          videoId = urlMatch[1];
        } else {
          throw new Error(`Failed to parse upload response: ${responseContent.stdout.substring(0, 500)}`);
        }
      }

      log.info(reqId, 'Video upload complete', {
        youtubeVideoId: videoId,
      });

      if (onProgress) {
        onProgress({ bytesUploaded: videoSizeBytes, totalBytes: videoSizeBytes, percentage: 100 });
      }

      return videoId;
    } finally {
      await sandbox.kill();
      log.info(reqId, 'E2B sandbox killed');
    }
  }

  /**
   * Upload video bytes using resumable upload
   * @returns The YouTube video ID when upload completes
   */
  async uploadVideoBytes(
    reqId: string,
    uploadUrl: string,
    videoBytes: Uint8Array,
    onProgress?: (progress: { bytesUploaded: number; totalBytes: number; percentage: number }) => void
  ): Promise<string> {
    log.info(reqId, 'Starting video upload', {
      totalBytes: videoBytes.length,
      totalBytesMB: (videoBytes.length / 1024 / 1024).toFixed(2),
    });

    const totalBytes = videoBytes.length;
    let bytesUploaded = 0;

    while (bytesUploaded < totalBytes) {
      const end = Math.min(bytesUploaded + CHUNK_SIZE, totalBytes);
      const chunk = videoBytes.slice(bytesUploaded, end);

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(chunk.length),
          'Content-Range': `bytes ${bytesUploaded}-${end - 1}/${totalBytes}`,
        },
        body: chunk,
      });

      // YouTube returns 201 Created with the video resource when upload is complete
      // and 308 Resume Incomplete when more data is needed
      if (response.status === 201) {
        // Parse the response to get the actual YouTube video ID
        const videoResource = await response.json() as YouTubeVideoResource;
        const actualVideoId = videoResource.id;

        log.info(reqId, 'Video upload complete', {
          totalBytes,
          bytesUploaded: totalBytes,
          youtubeVideoId: actualVideoId,
        });
        if (onProgress) {
          onProgress({ bytesUploaded: totalBytes, totalBytes, percentage: 100 });
        }
        return actualVideoId;
      }

      if (response.status === 308) {
        const range = response.headers.get('Range');
        if (range) {
          const match = range.match(/bytes=0-(\d+)/);
          if (match) {
            bytesUploaded = parseInt(match[1], 10) + 1;
          }
        } else {
          bytesUploaded = end;
        }

        // Check if all bytes have been uploaded
        if (bytesUploaded >= totalBytes) {
          // All bytes uploaded, extract video ID from upload URL
          const videoIdMatch = uploadUrl.match(/\/videos\/([a-zA-Z0-9_-]+)/);
          if (videoIdMatch) {
            const videoId = videoIdMatch[1];
            log.info(reqId, 'Video upload complete (all bytes received)', {
              totalBytes,
              bytesUploaded,
              youtubeVideoId: videoId,
            });
            if (onProgress) {
              onProgress({ bytesUploaded: totalBytes, totalBytes, percentage: 100 });
            }
            return videoId;
          }
        }

        if (onProgress) {
          onProgress({
            bytesUploaded,
            totalBytes,
            percentage: Math.floor((bytesUploaded / totalBytes) * 100),
          });
        }

        log.debug(reqId, 'Upload progress', {
          bytesUploaded,
          totalBytes,
          percentage: Math.floor((bytesUploaded / totalBytes) * 100),
        });

        // Small delay before next chunk
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Error response
      const errorText = await response.text();
      const error = new Error(errorText) as Error & { status?: number; bytesUploaded?: number };
      error.status = response.status;
      error.bytesUploaded = bytesUploaded;
      log.error(reqId, 'Upload failed', error);
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }
  }

  /**
   * Upload video stream directly to YouTube (memory-efficient for large videos)
   * Streams from R2 to YouTube without loading entire video into memory
   * @returns The YouTube video ID when upload completes
   */
  async uploadVideoStream(
    reqId: string,
    uploadUrl: string,
    videoStream: ReadableStream<Uint8Array>,
    videoSizeBytes: number,
    onProgress?: (progress: { bytesUploaded: number; totalBytes: number; percentage: number }) => void
  ): Promise<string> {
    log.info(reqId, 'Starting video stream upload', {
      totalBytes: videoSizeBytes,
      totalBytesMB: (videoSizeBytes / 1024 / 1024).toFixed(2),
    });

    // YouTube requires chunks >= 256KB (except final chunk)
    const CHUNK_SIZE = 256 * 1024; // 256KB
    const reader = videoStream.getReader();
    let bytesUploaded = 0;
    let buffer = new Uint8Array(CHUNK_SIZE);
    let bufferOffset = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        // If we have data, add to buffer
        if (value && value.length > 0) {
          // Ensure buffer is large enough
          if (bufferOffset + value.length > buffer.length) {
            const newBuffer = new Uint8Array(bufferOffset + value.length);
            newBuffer.set(buffer.subarray(0, bufferOffset));
            buffer = newBuffer;
          }
          buffer.set(value, bufferOffset);
          bufferOffset += value.length;
        }

        // Check if we should upload
        // - Upload when buffer has at least CHUNK_SIZE (256KB) for regular chunks
        // - OR when stream is done AND this is the final chunk (bytesUploaded + bufferOffset >= total size)
        // This ensures all chunks except the final one are multiples of 256KB
        const isFinalChunk = done && (bytesUploaded + bufferOffset >= videoSizeBytes);
        const shouldUpload = bufferOffset >= CHUNK_SIZE || isFinalChunk;

        if (shouldUpload) {
          const chunkToSend = buffer.subarray(0, bufferOffset);
          const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Length': String(chunkToSend.length),
              'Content-Range': `bytes ${bytesUploaded}-${bytesUploaded + chunkToSend.length - 1}/${videoSizeBytes}`,
            },
            body: chunkToSend,
          });

          // YouTube returns 201 Created with the video resource when upload is complete
          // and 308 Resume Incomplete when more data is needed
          if (response.status === 201) {
            const videoResource = await response.json() as YouTubeVideoResource;
            const actualVideoId = videoResource.id;

            log.info(reqId, 'Video stream upload complete', {
              totalBytes: videoSizeBytes,
              bytesUploaded: bytesUploaded + chunkToSend.length,
              youtubeVideoId: actualVideoId,
            });
            if (onProgress) {
              onProgress({ bytesUploaded: videoSizeBytes, totalBytes: videoSizeBytes, percentage: 100 });
            }
            return actualVideoId;
          }

          if (response.status === 308) {
            // Parse Range header to get actual uploaded bytes from YouTube
            // YouTube returns: "Range: bytes=0-XXXX" indicating bytes successfully received
            const range = response.headers.get('Range');
            if (range) {
              const match = range.match(/bytes=0-(\d+)/);
              if (match) {
                bytesUploaded = parseInt(match[1], 10) + 1;
              } else {
                // Fallback: assume chunk was uploaded
                bytesUploaded += chunkToSend.length;
              }
            } else {
              // No Range header, assume chunk was uploaded
              bytesUploaded += chunkToSend.length;
            }

            if (onProgress) {
              onProgress({
                bytesUploaded,
                totalBytes: videoSizeBytes,
                percentage: Math.floor((bytesUploaded / videoSizeBytes) * 100),
              });
            }

            log.debug(reqId, 'Stream upload progress', {
              bytesUploaded,
              totalBytes: videoSizeBytes,
              percentage: Math.floor((bytesUploaded / videoSizeBytes) * 100),
            });

            // Reset buffer
            buffer = new Uint8Array(CHUNK_SIZE);
            bufferOffset = 0;

            // If stream is done and all bytes uploaded, consider upload complete
            // Extract video ID from upload URL and return
            if (done && bytesUploaded >= videoSizeBytes) {
              log.info(reqId, 'All bytes uploaded, extracting video ID from URL');
              const videoIdMatch = uploadUrl.match(/\/videos\/([a-zA-Z0-9_-]+)/);
              if (videoIdMatch) {
                const videoId = videoIdMatch[1];
                log.info(reqId, 'Video upload complete', {
                  youtubeVideoId: videoId,
                  bytesUploaded,
                });
                if (onProgress) {
                  onProgress({ bytesUploaded: videoSizeBytes, totalBytes: videoSizeBytes, percentage: 100 });
                }
                return videoId;
              }
            }

            // If stream is done, exit loop
            if (done) break;
            continue;
          }

          // Error response
          const errorText = await response.text();
          const error = new Error(errorText) as Error & { status?: number; bytesUploaded?: number };
          error.status = response.status;
          error.bytesUploaded = bytesUploaded;
          log.error(reqId, 'Stream upload failed', error);
          throw new Error(`Stream upload failed: ${response.status} ${errorText}`);
        }

        // If stream is done and no more data to upload, exit
        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }

    // Debug logging before fallback check
    log.warn(reqId, 'Loop exited without returning', {
      bytesUploaded,
      videoSizeBytes,
      allBytesUploaded: bytesUploaded >= videoSizeBytes,
      uploadUrl: uploadUrl.substring(0, 100) + '...',
    });

    // If we've uploaded all bytes, extract video ID from upload URL and return
    // This handles the case where YouTube returns 308 for final chunk but doesn't return 201
    if (bytesUploaded >= videoSizeBytes) {
      const videoIdMatch = uploadUrl.match(/\/videos\/([a-zA-Z0-9_-]+)/);
      if (videoIdMatch) {
        const videoId = videoIdMatch[1];
        log.info(reqId, 'Video upload complete (fallback - all bytes uploaded)', {
          youtubeVideoId: videoId,
          bytesUploaded,
        });
        if (onProgress) {
          onProgress({ bytesUploaded: videoSizeBytes, totalBytes: videoSizeBytes, percentage: 100 });
        }
        return videoId;
      }
    }

    // Should not reach here, but handle edge case
    throw new Error('Stream upload completed without final response');
  }

  /**
   * Get video processing status from YouTube
   */
  async getVideoStatus(reqId: string, videoId: string): Promise<YouTubeVideoStatus> {
    log.debug(reqId, 'Fetching video status', { videoId });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=status,contentDetails&id=${videoId}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(errorText) as Error & { status?: number };
      error.status = response.status;
      log.error(reqId, 'Failed to fetch video status', error);
      throw new Error(`Failed to fetch video status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found');
    }

    const videoResource: YouTubeVideoResource = data.items[0];

    return {
      uploadStatus: videoResource.status.uploadStatus as any,
      processingStatus: videoResource.status.processingStatus as any,
      privacyStatus: videoResource.status.privacyStatus as any,
      failureReason: (videoResource.status as any).failureReason,
      rejectionReason: (videoResource.status as any).rejectionReason,
    };
  }

  /**
   * Poll video processing status until complete
   */
  async pollProcessingStatus(
    reqId: string,
    videoId: string,
    onStatusUpdate?: (status: YouTubeVideoStatus) => void
  ): Promise<YouTubeVideoStatus> {
    log.info(reqId, 'Starting processing status poll', { videoId });

    const startTime = Date.now();

    while (Date.now() - startTime < MAX_PROCESSING_TIME_MS) {
      const status = await this.getVideoStatus(reqId, videoId);

      if (onStatusUpdate) {
        onStatusUpdate(status);
      }

      log.debug(reqId, 'Processing status', {
        videoId,
        uploadStatus: status.uploadStatus,
        processingStatus: status.processingStatus,
      });

      // Check if processing is complete
      if (
        status.uploadStatus === 'processed' ||
        status.processingStatus === 'succeeded' ||
        status.uploadStatus === 'rejected' ||
        status.processingStatus === 'failed' ||
        status.uploadStatus === 'failed'
      ) {
        log.info(reqId, 'Video processing complete', {
          videoId,
          uploadStatus: status.uploadStatus,
          processingStatus: status.processingStatus,
        });
        return status;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, PROCESSING_POLL_INTERVAL_MS));
    }

    log.warn(reqId, 'Video processing timeout', { videoId });
    throw new Error('Video processing timeout');
  }

  /**
   * Get video resource with all details
   */
  async getVideo(reqId: string, videoId: string): Promise<YouTubeVideoResource> {
    log.debug(reqId, 'Fetching video details', { videoId });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,status,contentDetails&id=${videoId}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(errorText) as Error & { status?: number };
      error.status = response.status;
      log.error(reqId, 'Failed to fetch video', error);
      throw new Error(`Failed to fetch video: ${response.status}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found');
    }

    return data.items[0] as YouTubeVideoResource;
  }

  /**
   * Build YouTube info database record from upload
   */
  buildYouTubeInfo(
    reqId: string,
    localVideoId: number,
    youtubeVideoId: string,
    script: VideoScript,
    options?: Partial<YouTubeUploadOptions>
  ): Omit<YouTubeInfo, 'id' | 'created_at' | 'updated_at'> {
    const opts = { ...DEFAULT_UPLOAD_OPTIONS, ...options };

    log.info(reqId, 'Building YouTube info', {
      localVideoId,
      youtubeVideoId,
    });

    return {
      video_id: localVideoId,
      youtube_video_id: youtubeVideoId,
      youtube_video_url: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
      title: script.title || '',
      description: script.description || '',
      privacy_status: opts.privacy,
      tags: JSON.stringify(opts.tags),
      category_id: opts.categoryId,
      made_for_kids: opts.madeForKids ? 1 : 0,
      self_declared_made_for_kids: opts.selfDeclaredMadeForKids ? 1 : 0,
      contains_synthetic_media: opts.containsSyntheticMedia ? 1 : 0,
      not_paid_content: opts.notPaidContent ? 1 : 0,
      upload_started_at: new Date().toISOString(),
      upload_completed_at: null, // Will be set when upload completes
    };
  }

  /**
   * Update YouTube info with completion time
   */
  updateYouTubeInfoCompletion(reqId: string, youtubeInfo: YouTubeInfo): YouTubeInfo {
    log.info(reqId, 'Updating YouTube info completion', {
      youtubeVideoId: youtubeInfo.youtube_video_id,
    });

    return {
      ...youtubeInfo,
      upload_completed_at: new Date().toISOString(),
    };
  }

  private async prepareThumbnailForUpload(
    reqId: string,
    thumbnailImageBytes: Uint8Array
  ): Promise<{
    bytes: Uint8Array;
    quality: number;
    width: number;
    height: number;
    originalSizeBytes: number;
  }> {
    const sourceImage = await Image.decode(thumbnailImageBytes);
    const originalSizeBytes = thumbnailImageBytes.length;
    let bestCandidate: { bytes: Uint8Array; quality: number; width: number; height: number } | null = null;

    for (const targetSize of THUMBNAIL_TARGET_SIZES) {
      const workingImage = sourceImage.clone();
      const requiresResize = workingImage.width !== targetSize.width || workingImage.height !== targetSize.height;

      if (requiresResize) {
        workingImage.resize({
          width: targetSize.width,
          height: targetSize.height,
          fit: 'fill',
          method: 'bicubic'
        });
      }

      for (const quality of THUMBNAIL_QUALITY_STEPS) {
        const encodedBytes = await workingImage.encode('jpeg', { quality });
        const candidate = {
          bytes: encodedBytes,
          quality,
          width: workingImage.width,
          height: workingImage.height
        };

        if (!bestCandidate || candidate.bytes.length < bestCandidate.bytes.length) {
          bestCandidate = candidate;
        }

        if (candidate.bytes.length <= MAX_THUMBNAIL_SIZE_BYTES) {
          log.info(reqId, 'Prepared thumbnail for YouTube upload', {
            originalSizeBytes,
            finalSizeBytes: candidate.bytes.length,
            quality,
            width: workingImage.width,
            height: workingImage.height,
            wasResized: requiresResize
          });

          return {
            ...candidate,
            originalSizeBytes
          };
        }
      }
    }

    if (!bestCandidate) {
      throw new Error('Failed to create thumbnail candidate for YouTube upload');
    }

    const finalSizeMB = (bestCandidate.bytes.length / 1024 / 1024).toFixed(2);
    throw new Error(
      `Unable to compress thumbnail below 2MB. Best result: ${finalSizeMB}MB at ` +
      `${bestCandidate.width}x${bestCandidate.height}, quality=${bestCandidate.quality}`
    );
  }

  /**
   * Upload thumbnail to YouTube
   * @param reqId Request ID for logging
   * @param accessToken YouTube access token
   * @param youtubeVideoId YouTube video ID
   * @param thumbnailImageBytes Thumbnail image bytes
   */
  async uploadThumbnail(
    reqId: string,
    accessToken: string,
    youtubeVideoId: string,
    thumbnailImageBytes: Uint8Array
  ): Promise<{
    originalSizeBytes: number;
    uploadedSizeBytes: number;
    quality: number;
    width: number;
    height: number;
  }> {
    const originalSizeMB = (thumbnailImageBytes.length / 1024 / 1024).toFixed(2);

    log.info(reqId, 'Uploading thumbnail to YouTube', {
      youtubeVideoId,
      originalSizeBytes: thumbnailImageBytes.length,
      originalSizeMB
    });

    const preparedThumbnail = await this.prepareThumbnailForUpload(reqId, thumbnailImageBytes);

    const url = `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${youtubeVideoId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'image/jpeg'
      },
      body: preparedThumbnail.bytes
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(errorText) as Error & { status?: number };
      error.status = response.status;
      log.error(reqId, 'Failed to upload thumbnail', error);
      throw new Error(`Failed to upload thumbnail: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    log.info(reqId, 'Thumbnail uploaded successfully', {
      youtubeVideoId,
      result,
      originalSizeBytes: preparedThumbnail.originalSizeBytes,
      uploadedSizeBytes: preparedThumbnail.bytes.length,
      quality: preparedThumbnail.quality,
      width: preparedThumbnail.width,
      height: preparedThumbnail.height
    });

    return {
      originalSizeBytes: preparedThumbnail.originalSizeBytes,
      uploadedSizeBytes: preparedThumbnail.bytes.length,
      quality: preparedThumbnail.quality,
      width: preparedThumbnail.width,
      height: preparedThumbnail.height
    };
  }
}
