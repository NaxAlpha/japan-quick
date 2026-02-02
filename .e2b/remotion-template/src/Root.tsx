import React from 'react';
import { Composition } from 'remotion';
import { DynamicVideo } from './DynamicVideo';
import type { VideoInputProps } from './types';

// Calculate total duration from slides with transitions
const calculateDuration = (slides: VideoInputProps['slides']): number => {
  if (slides.length === 0) return 3000; // Default

  const TRANSITION_FRAMES = 30; // 1 second cross-fade
  let totalFrames = slides[0].durationInFrames;

  for (let i = 1; i < slides.length; i++) {
    // Each slide after the first overlaps by TRANSITION_FRAMES
    totalFrames += slides[i].durationInFrames - TRANSITION_FRAMES;
  }

  return totalFrames;
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
