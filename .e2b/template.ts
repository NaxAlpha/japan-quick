/**
 * E2B Template for Video Rendering
 * Pre-installs Remotion project with all dependencies
 */

import { Template } from 'e2b';

export const template = Template()
  .fromBunImage('1.3')
  // Install system packages for Remotion/Chromium
  .aptInstall([
    'ffmpeg',      // Still needed for Remotion encoding
    'fonts-noto-cjk-extra',
    'chromium',    // Required by Remotion for rendering
    'libnss3',
    'libatk-bridge2.0-0',
    'libdrm2',
    'libxkbcommon0',
    'libgbm1',
    'libasound2'
  ])
  // Set up Remotion project
  .setWorkdir('/home/user/remotion')
  .copy('./remotion-template', '/home/user/remotion')
  .runCmd('bun install')
  .runCmd('bunx remotion browser ensure')  // Pre-download Chromium during build
  .runCmd('echo "E2B build v3: $(date)" > /tmp/build_version.txt')  // Force cache invalidation
