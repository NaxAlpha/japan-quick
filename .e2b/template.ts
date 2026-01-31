/**
 * E2B Template for Video Rendering
 * Pre-installs ffmpeg and Japanese fonts for video composition
 */

import { Template } from 'e2b';

export const template = Template()
  .aptInstall([
    'ffmpeg',
    'curl',
    'fonts-noto-cjk-extra'
  ]);
