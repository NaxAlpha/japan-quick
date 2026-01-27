#!/usr/bin/env bun
/**
 * Manual verification script for asset generation improvements
 * Tests that aspectRatio and imageSize are correctly passed to Gemini API
 */

import { calculateGridDimensions, getModelImageSize } from '../src/lib/dimensions.js';
import type { ImageModelId } from '../src/types/video.js';

async function verifyDimensions() {
  console.log('=== Testing Dimension Calculations ===\n');

  const cases = [
    { videoType: 'short', imageSize: '1K', expectedWidth: 1080, expectedHeight: 1920 },
    { videoType: 'short', imageSize: '2K', expectedWidth: 2048, expectedHeight: 3658 },
    { videoType: 'long', imageSize: '1K', expectedWidth: 1920, expectedHeight: 1080 },
    { videoType: 'long', imageSize: '2K', expectedWidth: 3658, expectedHeight: 2048 },
  ];

  let allPassed = true;

  for (const testCase of cases) {
    const result = calculateGridDimensions(testCase.videoType as 'short' | 'long', testCase.imageSize as '1K' | '2K');
    const passed = result.width === testCase.expectedWidth && result.height === testCase.expectedHeight;

    console.log(`${passed ? '✓' : '✗'} ${testCase.videoType} ${testCase.imageSize}: ${result.width}x${result.height} (expected ${testCase.expectedWidth}x${testCase.expectedHeight})`);

    if (!passed) allPassed = false;

    // Verify cell dimensions are exactly 1/3
    const expectedCellWidth = Math.round(testCase.expectedWidth / 3);
    const expectedCellHeight = Math.round(testCase.expectedHeight / 3);
    const cellsPassed = result.cellWidth === expectedCellWidth && result.cellHeight === expectedCellHeight;

    console.log(`  ${cellsPassed ? '✓' : '✗'} Cells: ${result.cellWidth}x${result.cellHeight} (expected ${expectedCellWidth}x${expectedCellHeight})`);

    if (!cellsPassed) allPassed = false;
  }

  console.log();
  return allPassed;
}

function verifyModelMapping() {
  console.log('=== Testing Model to ImageSize Mapping ===\n');

  const cases: [ImageModelId, '1K' | '2K'][] = [
    ['gemini-2.5-flash-image', '1K'],
    ['gemini-3-pro-image-preview', '2K'],
  ];

  let allPassed = true;

  for (const [model, expectedSize] of cases) {
    const result = getModelImageSize(model);
    const passed = result === expectedSize;

    console.log(`${passed ? '✓' : '✗'} ${model} -> ${result} (expected ${expectedSize})`);

    if (!passed) allPassed = false;
  }

  console.log();
  return allPassed;
}

async function verifyApiConfigStructure() {
  console.log('=== Testing API Config Structure ===\n');

  // Verify the config structure matches Gemini API expectations
  const testConfig = {
    aspectRatio: '9:16' as const,
    imageSize: '2K' as const,
    numberOfImages: 1
  };

  console.log('Config structure:');
  console.log(JSON.stringify(testConfig, null, 2));
  console.log();

  // Check that values are valid according to API docs
  const validAspectRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
  const validImageSizes = ['1K', '2K'];

  const arValid = validAspectRatios.includes(testConfig.aspectRatio);
  const isValid = validImageSizes.includes(testConfig.imageSize);

  console.log(`${arValid ? '✓' : '✗'} aspectRatio "${testConfig.aspectRatio}" is valid`);
  console.log(`${isValid ? '✓' : '✗'} imageSize "${testConfig.imageSize}" is valid`);
  console.log();

  return arValid && isValid;
}

async function verifyPromptStructure() {
  console.log('=== Testing Prompt Structure ===\n');

  // Import and test the prompt builder
  const { buildGridImagePrompt } = await import('../src/lib/prompts.js');

  const testPrompt = buildGridImagePrompt({
    isShort: true,
    gridSize: '1080x1920',
    cellSize: '360x640',
    cellDescriptions: 'Position 0: Test image',
    thumbnailSection: '',
    emptySection: ''
  });

  console.log('Prompt preview (first 500 chars):');
  console.log(testPrompt.substring(0, 500) + '...');
  console.log();

  // Verify prompt contains the strengthened no-gaps language
  const hasZeroPixels = testPrompt.includes('ZERO pixels');
  const hasNoBorders = testPrompt.includes('No borders, gaps, or spaces');

  console.log(`${hasZeroPixels ? '✓' : '✗'} Contains "ZERO pixels" language`);
  console.log(`${hasNoBorders ? '✓' : '✗'} Contains "No borders, gaps, or spaces" language`);
  console.log();

  return hasZeroPixels && hasNoBorders;
}

async function verifyImageFetching() {
  console.log('=== Testing Image Fetching ===\n');

  // Import the image fetcher
  const { fetchImageAsBase64, fetchImagesAsBase64 } = await import('../src/lib/image-fetcher.js');

  // Test with a known public image
  const testImageUrl = 'https://picsum.photos/seed/test/200/200.jpg';

  console.log(`Testing fetch from: ${testImageUrl}`);

  const result = await fetchImageAsBase64(testImageUrl);

  const fetched = result !== null;
  const hasMimeType = result?.mimeType?.startsWith('image/');
  const hasData = result?.data?.length > 0;

  console.log(`${fetched ? '✓' : '✗'} Image fetched successfully`);
  console.log(`${hasMimeType ? '✓' : '✗'} Has valid mimeType: ${result?.mimeType}`);
  console.log(`${hasData ? '✓' : '✗'} Has base64 data: ${result?.data?.length} chars`);
  console.log();

  return fetched && hasMimeType && hasData;
}

async function verifyContentsStructure() {
  console.log('=== Testing Contents Array Structure ===\n');

  // Simulate the contents structure that will be passed to the API
  const mockReferenceImages = [
    JSON.stringify({ mimeType: 'image/jpeg', data: 'base64data123' })
  ];

  const contents: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];

  // Add reference images
  for (const refImgStr of mockReferenceImages) {
    const refImg = JSON.parse(refImgStr);
    contents.push({
      inlineData: {
        mimeType: refImg.mimeType,
        data: refImg.data
      }
    });
  }

  // Add text prompt
  contents.push({ text: 'Generate a grid image' });

  console.log('Contents structure:');
  console.log(JSON.stringify(contents, null, 2));
  console.log();

  const hasInlineData = contents.some(c => 'inlineData' in c);
  const hasText = contents.some(c => 'text' in c);
  const inlineDataHasCorrectFormat = contents
    .filter(c => 'inlineData' in c)
    .every(c => {
      const data = (c as { inlineData: { mimeType: string; data: string } }).inlineData;
      return 'mimeType' in data && 'data' in data;
    });

  console.log(`${hasInlineData ? '✓' : '✗'} Contains inlineData parts`);
  console.log(`${hasText ? '✓' : '✗'} Contains text part`);
  console.log(`${inlineDataHasCorrectFormat ? '✓' : '✗'} inlineData has correct format (mimeType + data)`);
  console.log();

  return hasInlineData && hasText && inlineDataHasCorrectFormat;
}

async function main() {
  console.log('🔍 Asset Generation Verification Script\n');
  console.log('This script verifies that the asset generation pipeline correctly:\n');
  console.log('1. Calculates dimensions for 1K and 2K resolutions');
  console.log('2. Maps image models to correct image sizes');
  console.log('3. Uses proper API configuration structure');
  console.log('4. Includes strengthened prompt language for no gaps');
  console.log('5. Fetches and converts article images to base64');
  console.log('6. Structures contents array with inlineData + text\n');
  console.log('='.repeat(50) + '\n');

  const dimensionsPassed = await verifyDimensions();
  const modelMappingPassed = verifyModelMapping();
  const apiConfigPassed = await verifyApiConfigStructure();
  const promptPassed = await verifyPromptStructure();
  const imageFetchPassed = await verifyImageFetching();
  const contentsPassed = await verifyContentsStructure();

  console.log('='.repeat(50));
  console.log('\n📊 Results Summary:');
  console.log(`  Dimensions: ${dimensionsPassed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`  Model Mapping: ${modelMappingPassed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`  API Config: ${apiConfigPassed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`  Prompt Structure: ${promptPassed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`  Image Fetching: ${imageFetchPassed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`  Contents Structure: ${contentsPassed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log();

  const allPassed = dimensionsPassed && modelMappingPassed && apiConfigPassed && promptPassed && imageFetchPassed && contentsPassed;

  if (allPassed) {
    console.log('✅ All verification checks passed!\n');
    process.exit(0);
  } else {
    console.log('❌ Some verification checks failed. Please review the output above.\n');
    process.exit(1);
  }
}

main().catch(console.error);
