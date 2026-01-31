import React from 'react';
import { Composition } from 'remotion';
import { DynamicVideo } from './DynamicVideo';
import type { VideoInputProps } from './types';

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
      />
    </>
  );
};
