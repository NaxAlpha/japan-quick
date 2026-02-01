import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);

// Increase timeout for asset downloads (default is 30 seconds)
// E2B sandboxes may have slower network to R2, so increase to 60 seconds
Config.setDelayRenderTimeoutInMilliseconds(60000);

// Chrome flags for stability during long renders
// Prevents crashes on long-running video renders
Config.setChromiumHeadlessMode(true);
Config.setChromiumOpenGlRenderer('swangle'); // Use swiftshader on angle (stable for long renders)
Config.setChromiumDisableWebSecurity(false);

// Additional stability flags
const stabilityFlags = [
  '--disable-dev-shm-usage',  // Use /tmp instead of shared memory
  '--disable-gpu',             // Disable GPU acceleration (swangle is software renderer)
  '--no-sandbox',              // Required in Docker/E2B environments
  '--disable-software-rasterizer', // Let swangle handle rendering
];

// Note: setChromiumHeadlessMode and other methods don't accept custom flags directly
// These flags are automatically applied by Remotion based on the GL renderer choice
// Cache bust: Sat Jan 31 19:58:50 PKT 2026
// Template rebuild: Sun Feb  1 10:34:49 PKT 2026
// Template rebuild: Sun Feb  1 10:34:56 PKT 2026
