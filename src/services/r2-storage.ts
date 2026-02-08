/**
 * R2 Storage Service
 * Handles upload, retrieval, and deletion of video assets in R2
 */

// Public domain for serving assets
const PUBLIC_DOMAIN = 'japan-quick-assets.nauman.im';

export class R2StorageService {
  private publicBaseUrl: string;

  constructor(private bucket: R2Bucket, publicBaseUrl?: string) {
    const normalizedBase = publicBaseUrl?.replace(/\/+$/, '');
    this.publicBaseUrl = normalizedBase || `https://${PUBLIC_DOMAIN}`;
  }

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
    return `${this.publicBaseUrl}/${ulid}.${ext}`;
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
   * Retrieve a video asset from R2
   */
  async getAsset(key: string): Promise<R2ObjectBody | null> {
    return this.bucket.get(key);
  }

  /**
   * Delete a specific asset by key
   */
  async deleteAsset(key: string): Promise<void> {
    await this.bucket.delete(key);
  }
}
