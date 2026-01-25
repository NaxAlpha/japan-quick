/**
 * R2 Storage Service
 * Handles upload, retrieval, and deletion of video assets in R2
 */

export class R2StorageService {
  constructor(private bucket: R2Bucket) {}

  /**
   * Upload a video asset to R2
   */
  async uploadAsset(
    videoId: number,
    type: 'grid_image' | 'slide_audio',
    index: number,
    data: ArrayBuffer,
    mimeType: string
  ): Promise<{ key: string; size: number }> {
    const ext = mimeType === 'image/png' ? 'png' : 'wav';
    const prefix = type === 'grid_image' ? 'grid' : 'audio';
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
   * Delete all assets for a video
   */
  async deleteVideoAssets(videoId: number): Promise<void> {
    const list = await this.bucket.list({ prefix: `videos/${videoId}/` });
    for (const obj of list.objects) {
      await this.bucket.delete(obj.key);
    }
  }
}
