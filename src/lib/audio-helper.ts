/**
 * Audio Helper - Audio conversion utilities
 * Provides PCM to WAV conversion for TTS audio generation
 */

/**
 * Convert PCM audio to WAV format with header
 * @param pcmBase64 Base64-encoded PCM audio data
 * @param sampleRate Sample rate in Hz (e.g., 24000)
 * @param channels Number of audio channels (1 = mono, 2 = stereo)
 * @param bitDepth Bit depth (16 = 16-bit audio)
 * @returns Base64-encoded WAV audio data
 */
export function pcmToWav(
  pcmBase64: string,
  sampleRate: number,
  channels: number,
  bitDepth: number
): string {
  const pcm = Uint8Array.from(atob(pcmBase64), c => c.charCodeAt(0));
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF header
  view.setUint32(0, 0x52494646, false);  // "RIFF"
  view.setUint32(4, 36 + pcm.length, true);
  view.setUint32(8, 0x57415645, false);  // "WAVE"

  // fmt subchunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);          // Subchunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bitDepth / 8, true);
  view.setUint16(32, channels * bitDepth / 8, true);
  view.setUint16(34, bitDepth, true);

  // data subchunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, pcm.length, true);

  const wav = new Uint8Array(44 + pcm.length);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, 44);

  // Convert to base64 in chunks to avoid stack overflow
  const chunkSize = 8192; // Process 8KB at a time
  let binary = '';
  for (let i = 0; i < wav.length; i += chunkSize) {
    const chunk = wav.subarray(i, Math.min(i + chunkSize, wav.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Calculate audio duration from PCM data
 * @param pcmBase64 Base64-encoded PCM audio data
 * @param sampleRate Sample rate in Hz
 * @param channels Number of audio channels
 * @param bytesPerSample Bytes per sample (2 for 16-bit)
 * @returns Duration in milliseconds
 */
export function calculatePcmDuration(
  pcmBase64: string,
  sampleRate: number,
  channels: number,
  bytesPerSample: number = 2
): number {
  const pcmBytes = atob(pcmBase64).length;
  return (pcmBytes / (sampleRate * channels * bytesPerSample)) * 1000;
}
