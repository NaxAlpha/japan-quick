/**
 * SlideTitle Component
 * Displays animated headlines with fade-underline animation
 * OPTIMIZED: Uses React.memo and useMemo to prevent memory leaks during long renders
 */

import React, { useMemo, memo } from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';
import { headlineContainer, headlineText, headlineUnderline } from '../styles';

interface SlideTitleProps {
  headline: string;
  durationInFrames: number;
}

const FADE_DURATION_FRAMES = 30; // 1 second at 30 FPS

/**
 * Memoized slide title to prevent re-renders when props haven't changed
 */
export const SlideTitle = memo<SlideTitleProps>(({
  headline,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();

  const fadeOutStart = durationInFrames - FADE_DURATION_FRAMES;

  // Memoize text opacity calculation
  const textOpacity = useMemo(() => {
    return frame < FADE_DURATION_FRAMES
      ? interpolate(frame, [0, FADE_DURATION_FRAMES], [0, 1], { extrapolateRight: 'clamp' })
      : frame < fadeOutStart
      ? 1
      : interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], { extrapolateRight: 'clamp' });
  }, [frame, durationInFrames, fadeOutStart]);

  // Memoize container style with opacity
  const containerStyle = useMemo(() => ({
    ...headlineContainer,
    opacity: textOpacity,
  }), [textOpacity]);

  // Memoize underline animation values
  const { underlineScale, underlineOrigin } = useMemo(() => {
    if (frame < FADE_DURATION_FRAMES) {
      return {
        underlineScale: interpolate(frame, [0, FADE_DURATION_FRAMES], [0, 1], { extrapolateRight: 'clamp' }),
        underlineOrigin: 'left' as const,
      };
    } else if (frame < fadeOutStart) {
      return {
        underlineScale: 1,
        underlineOrigin: 'left' as const,
      };
    } else {
      return {
        underlineScale: interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], { extrapolateRight: 'clamp' }),
        underlineOrigin: 'right' as const,
      };
    }
  }, [frame, durationInFrames, fadeOutStart]);

  // Memoize underline style
  const underlineStyle = useMemo(() => ({
    ...headlineUnderline,
    transformOrigin: underlineOrigin,
    transform: `scaleX(${underlineScale})`,
  }), [underlineScale, underlineOrigin]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={containerStyle}>
        <h2 style={headlineText}>
          {headline}
        </h2>
        <div style={underlineStyle} />
      </div>
    </AbsoluteFill>
  );
});

SlideTitle.displayName = 'SlideTitle';
