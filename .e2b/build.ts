/**
 * Build script for E2B video rendering template
 */

import 'dotenv/config';
import { Template, defaultBuildLogger } from 'e2b';
import { template } from './template';

async function main() {
  console.log('Building E2B video rendering template...');

  await Template.build(template, {
    alias: 'video-renderer',
    cpuCount: 8,  // Max CPU for fastest encoding
    memoryMB: 8192,  // 8GB RAM for video processing
    diskSizeMB: { value: 16 * 1024 },  // 16GB disk for temporary video files
    onBuildLogs: defaultBuildLogger(),
  });

  console.log('Template built successfully!');
  console.log('You can now use it with: Sandbox.create("video-renderer")');
}

main().catch(console.error);
