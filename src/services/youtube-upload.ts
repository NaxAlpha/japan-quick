/**
 * YouTube Upload Service
 * Handles video upload to YouTube using the resumable upload API
 */

import { createLogger } from '../lib/logger.js';
import type {
  YouTubeUploadSession,
  YouTubeVideoStatus,
  YouTubeVideoResource,
  YouTubeUploadOptions,
  YouTubeInfo
} from '../types/youtube.js';
import type { VideoScript } from '../types/video.js';

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

/**
 * YouTube Upload Service Class
 */
export class YouTubeUploadService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
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

      // YouTube returns 200 OK with the video resource when upload is complete
      // and 308 Resume Incomplete when more data is needed
      if (response.status === 200) {
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
      title: script.title,
      description: script.description,
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
}
