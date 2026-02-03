/**
 * R2 Storage Service
 * Handles upload, retrieval, and deletion of video assets in R2
 */

// Public domain for serving assets
const PUBLIC_DOMAIN = 'japan-quick-assets.nauman.im';

export class R2StorageService {
  constructor(private bucket: R2Bucket) {}

  /**
   * Upload a video asset to R2 using new ULID-based flat naming
   * Assets are stored at bucket root as {ulid}.{ext}
   */
  async uploadAsset(
    ulid: string,
    data: ArrayBuffer,
    mimeType: string
  ): Promise<{ key: string; size: number; publicUrl: string }> {
    const ext = this.getExtension(mimeType);
    const key = `${ulid}.${ext}`;

    await this.bucket.put(key, data, {
      httpMetadata: { contentType: mimeType }
    });

    return {
      key,
      size: data.byteLength,
      publicUrl: this.getPublicUrl(ulid, mimeType)
    };
  }

  /**
   * Get the public URL for an asset
   */
  getPublicUrl(ulid: string, mimeType: string): string {
    const ext = this.getExtension(mimeType);
    return `https://${PUBLIC_DOMAIN}/${ulid}.${ext}`;
  }

  /**
   * Get file extension from MIME type
   * Handles MIME types with charset parameters (e.g., "text/plain; charset=utf-8")
   */
  private getExtension(mimeType: string): string {
    // Strip charset and other parameters for extension lookup
    const baseMimeType = mimeType.split(';')[0].trim();

    const mimeToExt: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'audio/wav': 'wav',
      'audio/mpeg': 'mp3',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'text/plain': 'txt'
    };
    return mimeToExt[baseMimeType] || 'bin';
  }

  /**
   * Upload a video asset to R2 using legacy hierarchical naming
   * Kept for backward compatibility
   */
  async uploadAssetLegacy(
    videoId: number,
    type: 'grid_image' | 'slide_audio' | 'rendered_video',
    index: number,
    data: ArrayBuffer,
    mimeType: string
  ): Promise<{ key: string; size: number }> {
    const ext = this.getExtension(mimeType);
    let prefix: string;

    switch (type) {
      case 'grid_image':
        prefix = 'grid';
        break;
      case 'slide_audio':
        prefix = 'audio';
        break;
      case 'rendered_video':
        prefix = 'video';
        break;
    }

    const key = `videos/${videoId}/${prefix}_${String(index).padStart(2, '0')}.${ext}`;

    await this.bucket.put(key, data, {
      httpMetadata: { contentType: mimeType }
    });

    return { key, size: data.byteLength };
  }

  /**
   * Retrieve a video asset from R2
   */
  async getAsset(key: string): Promise<R2ObjectBody | null> {
    return this.bucket.get(key);
  }

  /**
   * Delete all assets for a video (legacy format)
   */
  async deleteVideoAssets(videoId: number): Promise<void> {
    const list = await this.bucket.list({ prefix: `videos/${videoId}/` });
    for (const obj of list.objects) {
      await this.bucket.delete(obj.key);
    }
  }

  /**
   * Delete a specific asset by key
   */
  async deleteAsset(key: string): Promise<void> {
    await this.bucket.delete(key);
  }
}
