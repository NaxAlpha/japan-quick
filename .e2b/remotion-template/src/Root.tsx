import React from 'react';
import { Composition } from 'remotion';
import { DynamicVideo } from './DynamicVideo';
import type { VideoInputProps } from './types';

// Calculate total duration from slides
// Sequences are sequential (no overlap) - sum all slide durations
const calculateDuration = (slides: VideoInputProps['slides']): number => {
  if (slides.length === 0) return 3000; // Default

  return slides.reduce((sum, slide) => sum + slide.durationInFrames, 0);
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DynamicVideo"
        component={DynamicVideo}
        durationInFrames={3000}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          slides: [],
          videoType: 'short' as const,
          articleDate: new Date().toISOString(),
        } as VideoInputProps}
        calculateMetadata={({ props }) => {
          const isLandscape = props.videoType === 'long';
          return {
            durationInFrames: calculateDuration(props.slides),
            width: isLandscape ? 1920 : 1080,
            height: isLandscape ? 1080 : 1920,
          };
        }}
      />
    </>
  );
};
