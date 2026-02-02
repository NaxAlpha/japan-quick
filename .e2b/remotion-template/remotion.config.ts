import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg'); // Use JPEG for memory efficiency
Config.setJpegQuality(90); // 90% quality for good output
Config.setOverwriteOutput(true);

// Increase timeout for asset downloads
Config.setDelayRenderTimeoutInMilliseconds(60000);

// Chrome flags for stability during long renders
Config.setChromiumHeadlessMode(true);
Config.setChromiumOpenGlRenderer('swangle');
Config.setChromiumDisableWebSecurity(false);

// Additional stability flags
const stabilityFlags = [
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--disable-software-rasterizer',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-features=Translate',
  '--disable-features=VizDisplayCompositor',
];

// JPEG 90% quality with React optimizations and 8GB RAM
// Template rebuilt: Sun Feb  1 2026 (final: JPEG 90%)
