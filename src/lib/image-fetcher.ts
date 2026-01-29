/**
 * Image Fetcher Utility
 * Fetches images from URLs and converts to base64 for Gemini API
 */

import { IMAGE_FETCHING, SCRAPING } from './constants.js';

interface FetchedImage {
  mimeType: string;
  data: string; // base64 encoded
}

/**
 * Fetch an image from URL and convert to base64
 */
export async function fetchImageAsBase64(url: string): Promise<FetchedImage | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(IMAGE_FETCHING.TIMEOUT_MS),
      headers: {
        'User-Agent': SCRAPING.USER_AGENT
      }
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return {
      mimeType: contentType,
      data: base64
    };
  } catch (error) {
    // Log but don't throw - individual image failures shouldn't block generation
    console.error(`Failed to fetch image from ${url}:`, error);
    return null;
  }
}

/**
 * Fetch multiple images from URLs
 * Returns array of successfully fetched images
 */
export async function fetchImagesAsBase64(urls: string[], maxImages = 3): Promise<FetchedImage[]> {
  // Fetch all images in parallel
  const results = await Promise.all(
    urls.slice(0, maxImages).map(url => fetchImageAsBase64(url))
  );

  // Filter out nulls (failed fetches)
  return results.filter((img): img is FetchedImage => img !== null);
}
