/**
 * Test Chunked Upload Workflow
 * Tests chunked R2 upload within Worker memory constraints
 * Creates 75MB dummy file, uploads via multipart upload
 */

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import type { Env } from '../types/env.js';
import { log, generateRequestId } from '../lib/logger.js';

export interface TestChunkedParams {
  testSize?: number; // Size in MB (default 75)
}

export interface TestChunkedResult {
  success: boolean;
  fileSize: number;
  chunkCount: number;
  uploadKey?: string;
  error?: string;
}

export class TestChunkedWorkflow extends WorkflowEntrypoint<Env['Bindings'], TestChunkedParams, TestChunkedResult> {
  async run(event: WorkflowEvent<TestChunkedParams>, step: WorkflowStep): Promise<TestChunkedResult> {
    const reqId = generateRequestId();
    const startTime = Date.now();
    const testSizeMB = event.payload.testSize || 75;

    log.testChunked.info(reqId, 'Test chunked upload workflow started', { testSizeMB });

    try {
      // Step 1: Create dummy data (75MB)
      const { chunks, totalSize } = await step.do('create-dummy-data', async () => {
        const CHUNK_SIZE = 15 * 1024 * 1024; // 15MB
        const totalSize = testSizeMB * 1024 * 1024;

        log.testChunked.info(reqId, 'Creating dummy data', {
          totalSizeMB: testSizeMB,
          chunkSizeMB: CHUNK_SIZE / 1024 / 1024
        });

        // Create 75MB dummy data
        const dummyData = new Uint8Array(totalSize);
        for (let i = 0; i < Math.min(1000, dummyData.length); i++) {
          dummyData[i] = i % 256;
        }

        // Split into chunks (only store chunk metadata, not data itself)
        const chunks: Array<{ index: number; size: number }> = [];
        for (let offset = 0; offset < totalSize; offset += CHUNK_SIZE) {
          const end = Math.min(offset + CHUNK_SIZE, totalSize);
          chunks.push({ index: Math.floor(offset / CHUNK_SIZE), size: end - offset });
        }

        log.testChunked.info(reqId, 'Dummy data created', {
          totalSize,
          chunkCount: chunks.length
        });

        return { chunks, totalSize };
      });

      // Step 2: Perform chunked upload to R2 using correct R2 multipart API
      const uploadResult = await step.do('chunked-upload', async () => {
        const { ulid } = await import('ulid');
        const uploadKey = `test-chunked-${ulid()}.bin`;
        const CHUNK_SIZE = 15 * 1024 * 1024; // 15MB

        log.testChunked.info(reqId, 'Starting R2 multipart upload', {
          uploadKey,
          chunkCount: chunks.length,
          totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
        });

        // Create multipart upload
        const multipartUpload = await this.env.ASSETS_BUCKET.createMultipartUpload(uploadKey, {
          customMetadata: {
            test: 'chunked-upload',
            contentType: 'application/octet-stream'
          },
          httpMetadata: {
            contentType: 'application/octet-stream'
          }
        });

        const uploadId = multipartUpload.uploadId;

        log.testChunked.info(reqId, 'Multipart upload created', { uploadId, key: multipartUpload.key });

        const uploadedParts: Array<{ partNumber: number; etag: string }> = [];
        let totalUploaded = 0;

        // Process chunks ONE AT A TIME - create, upload, discard
        for (const chunkInfo of chunks) {
          const partNumber = chunkInfo.index + 1;

          log.testChunked.info(reqId, `Processing chunk ${partNumber}/${chunks.length}`, {
            chunkSize: chunkInfo.size,
            chunkSizeMB: (chunkInfo.size / 1024 / 1024).toFixed(2)
          });

          // Create chunk data (only this chunk in memory)
          const chunkData = new Uint8Array(chunkInfo.size);
          for (let i = 0; i < chunkInfo.size; i++) {
            chunkData[i] = (partNumber + i) % 256;
          }

          // Upload this part using the multipart upload object
          const uploadedPart = await multipartUpload.uploadPart(partNumber, chunkData);

          uploadedParts.push({
            partNumber,
            etag: uploadedPart.etag
          });

          totalUploaded += chunkInfo.size;

          log.testChunked.info(reqId, `Chunk ${partNumber} uploaded`, {
            etag: uploadedPart.etag,
            totalUploadedMB: (totalUploaded / 1024 / 1024).toFixed(2)
          });

          // chunkData goes out of scope here - garbage collected
          // Only ONE chunk in memory at a time
        }

        // Complete multipart upload
        log.testChunked.info(reqId, 'Completing multipart upload', {
          partCount: uploadedParts.length,
          totalSizeMB: (totalUploaded / 1024 / 1024).toFixed(2)
        });

        const object = await multipartUpload.complete(uploadedParts);

        log.testChunked.info(reqId, 'Upload complete', {
          httpEtag: object.httpEtag,
          uploadKey
        });

        return { uploadKey, totalSize };
      });

      log.testChunked.info(reqId, 'Test completed successfully', {
        durationMs: Date.now() - startTime,
        fileSize: uploadResult.totalSize,
        chunkCount: chunks.length,
        uploadKey: uploadResult.uploadKey
      });

      return {
        success: true,
        fileSize: uploadResult.totalSize,
        chunkCount: chunks.length,
        uploadKey: uploadResult.uploadKey
      };
    } catch (error) {
      log.testChunked.error(reqId, 'Test failed', error as Error);
      return {
        success: false,
        fileSize: 0,
        chunkCount: 0,
        error: (error as Error).message
      };
    }
  }
}
