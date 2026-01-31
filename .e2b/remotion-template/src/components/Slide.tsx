/**
 * Slide component - Complete scene with background, audio, headline, and date badge
 */

import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill, Audio, Img, Sequence } from 'remotion';
import { SlideTitle } from './SlideTitle';
import { DateBadge } from './DateBadge';
import { BackgroundAnimation } from './BackgroundAnimation';
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
 * Slide component wraps a complete scene with:
 * - Background image with zoom animation
 * - Audio narration
 * - Animated headline (if provided)
 * - Date badge
 * - Fade in/out transitions
 */
export const Slide: React.FC<SlideProps> = ({
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

  // Audio delay: For scenes that fade in (all except first), delay audio by FADE_DURATION_FRAMES
  // This creates 1 second of silence during the cross-fade transition
  const audioStartFrame = fadeIn ? FADE_DURATION_FRAMES : 0;

  // Audio end frame: Stop audio before fade-out to ensure silence during transition
  // For scenes that fade out, audio should end FADE_DURATION_FRAMES before scene ends
  const audioEndFrame = fadeOut ? durationInFrames - FADE_DURATION_FRAMES : durationInFrames;

  // Fade opacity calculation
  const fadeOutStart = durationInFrames - FADE_DURATION_FRAMES;
  let opacity: number;

  if (fadeIn && fadeOut) {
    // Middle scenes: fade in and fade out
    opacity =
      frame < FADE_DURATION_FRAMES
        ? interpolate(frame, [0, FADE_DURATION_FRAMES], [0, 1], { extrapolateRight: 'clamp' })
        : frame < fadeOutStart
        ? 1
        : interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], { extrapolateRight: 'clamp' });
  } else if (fadeIn) {
    // Last scene: only fade in
    opacity =
      frame < FADE_DURATION_FRAMES
        ? interpolate(frame, [0, FADE_DURATION_FRAMES], [0, 1], { extrapolateRight: 'clamp' })
        : 1;
  } else if (fadeOut) {
    // First scene: only fade out
    opacity =
      frame < fadeOutStart
        ? 1
        : interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], { extrapolateRight: 'clamp' });
  } else {
    // No fades (edge case)
    opacity = 1;
  }

  return (
    <AbsoluteFill style={{ opacity, overflow: 'hidden', backgroundColor: 'black' }}>
      {/* Background image with Ken Burns zoom animation */}
      <BackgroundAnimation
        zoomDirection={zoomDirection}
        durationInFrames={durationInFrames}
      >
        <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </BackgroundAnimation>

      {/* Audio narration - delayed for non-first scenes to create silence during transition */}
      {audioStartFrame > 0 ? (
        <Sequence from={audioStartFrame} durationInFrames={audioEndFrame - audioStartFrame}>
          <Audio src={audioUrl} />
        </Sequence>
      ) : (
        <Audio src={audioUrl} endAt={audioEndFrame} />
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
};
