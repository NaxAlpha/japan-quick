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
    cpuCount: 2,  // Sufficient for video encoding
    memoryMB: 4096,  // 4GB RAM for video processing
    diskSizeMB: { value: 10 * 1024 },  // 10GB disk (max on current plan)
    onBuildLogs: defaultBuildLogger(),
  });

  console.log('Template built successfully!');
  console.log('You can now use it with: Sandbox.create("video-renderer")');
}

main().catch(console.error);
