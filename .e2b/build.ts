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
    cpuCount: 4,  // 4 CPU for parallel rendering
    memoryMB: 6144,  // 6GB RAM (Chrome + video processing needs more for long videos)
    diskSizeMB: { value: 12 * 1024 },  // 12GB disk for temporary files
    onBuildLogs: defaultBuildLogger(),
  });

  console.log('Template built successfully!');
  console.log('You can now use it with: Sandbox.create("video-renderer")');
}

main().catch(console.error);
