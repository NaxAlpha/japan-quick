/**
 * DynamicVideo - Main composition that renders video from input props
 * OPTIMIZED: Uses React.memo to prevent memory leaks during long renders
 */

import React, { useMemo, memo } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { Slide } from './components/Slide';
import type { VideoInputProps, ZoomDirection } from './types';

const TRANSITION_FRAMES = 30; // 1 second cross-fade at 30 FPS

/**
 * Memoized dynamic video to prevent re-renders when props haven't changed
 */
export const DynamicVideo = memo<VideoInputProps>(({ slides, videoType, articleDate }) => {
  // Memoize slide sequences calculation (only recalculates when slides change)
  const slideSequences = useMemo(() => {
    let currentFrame = 0;

    return slides.map((slide, index) => {
      const isFirst = index === 0;
      const isLast = index === slides.length - 1;

      // Determine zoom direction (alternate between in and out)
      const zoomDirection: ZoomDirection = index % 2 === 0 ? 'in' : 'out';

      // Calculate start frame - NO overlap, sequences are sequential
      const startFrame = currentFrame;

      // Move current frame forward by full slide duration
      currentFrame += slide.durationInFrames;

      return {
        slide,
        startFrame,
        zoomDirection,
        fadeIn: !isFirst,
        fadeOut: !isLast,
      };
    });
  }, [slides]);

  return (
    <AbsoluteFill className="bg-black">
      {slideSequences.map((seq, index) => (
        <Sequence
          key={index}
          from={seq.startFrame}
          durationInFrames={seq.slide.durationInFrames}
        >
          <Slide
            imageUrl={seq.slide.imageUrl}
            audioUrl={seq.slide.audioUrl}
            headline={seq.slide.headline}
            date={articleDate}
            durationInFrames={seq.slide.durationInFrames}
            zoomDirection={seq.zoomDirection}
            fadeIn={seq.fadeIn}
            fadeOut={seq.fadeOut}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
});

DynamicVideo.displayName = 'DynamicVideo';
