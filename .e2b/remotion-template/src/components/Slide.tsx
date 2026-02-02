/**
 * Slide component - Complete scene with background, audio, headline, and date badge
 * OPTIMIZED: Uses React.memo and useMemo to prevent memory leaks during long renders
 */

import React, { useMemo, useCallback, memo } from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill, Audio, Img, Sequence, staticFile } from 'remotion';
import { SlideTitle } from './SlideTitle';
import { DateBadge } from './DateBadge';
import { BackgroundAnimation } from './BackgroundAnimation';
import { absoluteFillHidden, fullCoverImage } from '../styles';
import type { ZoomDirection } from '../types';

interface SlideProps {
  imageUrl: string;          // Public R2 URL
  audioUrl: string;          // Public R2 URL
  headline?: string;
  date: string;
  durationInFrames: number;
  zoomDirection: ZoomDirection;
  fadeIn: boolean;          // true for all scenes except first
  fadeOut: boolean;         // true for all scenes except last
}

const FADE_DURATION_FRAMES = 30; // 1 second at 30 FPS

/**
 * Memoized slide wrapper to prevent re-renders when props haven't changed
 */
export const Slide = memo<SlideProps>(({
  imageUrl,
  audioUrl,
  headline,
  date,
  durationInFrames,
  zoomDirection,
  fadeIn,
  fadeOut,
}) => {
  const frame = useCurrentFrame();

  // Memoize URL resolution to avoid string operations on every render
  const resolvedImageUrl = useMemo(() => {
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    return staticFile(imageUrl);
  }, [imageUrl]);

  const resolvedAudioUrl = useMemo(() => {
    if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
      return audioUrl;
    }
    return staticFile(audioUrl);
  }, [audioUrl]);

  // Memoize audio timing calculations
  const { audioStartFrame, audioEndFrame } = useMemo(() => {
    return {
      audioStartFrame: fadeIn ? FADE_DURATION_FRAMES : 0,
      audioEndFrame: fadeOut ? durationInFrames - FADE_DURATION_FRAMES : durationInFrames,
    };
  }, [fadeIn, fadeOut, durationInFrames]);

  // Memoize fade opacity calculation (only recalculates when frame crosses boundaries)
  const opacity = useMemo(() => {
    const fadeOutStart = durationInFrames - FADE_DURATION_FRAMES;

    if (fadeIn && fadeOut) {
      // Middle scenes: fade in and fade out
      return frame < FADE_DURATION_FRAMES
        ? interpolate(frame, [0, FADE_DURATION_FRAMES], [0, 1], { extrapolateRight: 'clamp' })
        : frame < fadeOutStart
        ? 1
        : interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], { extrapolateRight: 'clamp' });
    } else if (fadeIn) {
      // Last scene: only fade in
      return frame < FADE_DURATION_FRAMES
        ? interpolate(frame, [0, FADE_DURATION_FRAMES], [0, 1], { extrapolateRight: 'clamp' })
        : 1;
    } else if (fadeOut) {
      // First scene: only fade out
      return frame < fadeOutStart
        ? 1
        : interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], { extrapolateRight: 'clamp' });
    }
    return 1; // No fades
  }, [frame, fadeIn, fadeOut, durationInFrames]);

  // Memoize container style with opacity (only creates new object when opacity changes)
  const containerStyle = useMemo(() => ({
    ...absoluteFillHidden,
    opacity,
  }), [opacity]);

  return (
    <AbsoluteFill style={containerStyle}>
      {/* Background image with Ken Burns zoom animation */}
      <BackgroundAnimation
        zoomDirection={zoomDirection}
        durationInFrames={durationInFrames}
      >
        <Img
          src={resolvedImageUrl}
          style={fullCoverImage}
          delayRenderTimeoutInMilliseconds={60000}
        />
      </BackgroundAnimation>

      {/* Audio narration - delayed for non-first scenes to create silence during transition */}
      {audioStartFrame > 0 ? (
        <Sequence from={audioStartFrame} durationInFrames={audioEndFrame - audioStartFrame}>
          <Audio src={resolvedAudioUrl} delayRenderTimeoutInMilliseconds={60000} />
        </Sequence>
      ) : (
        <Audio src={resolvedAudioUrl} endAt={audioEndFrame} delayRenderTimeoutInMilliseconds={60000} />
      )}

      {/* Headline overlay with fade-underline animation */}
      {headline && (
        <SlideTitle
          headline={headline}
          durationInFrames={durationInFrames}
        />
      )}

      {/* Date badge with fade-in animation */}
      <DateBadge
        date={date}
        durationInFrames={durationInFrames}
      />
    </AbsoluteFill>
  );
});

Slide.displayName = 'Slide';
