/**
 * SlideTitle Component
 * Displays animated headlines with fade-underline animation
 */

import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

interface SlideTitleProps {
  headline: string;
  durationInFrames: number;
}

const FADE_DURATION_FRAMES = 30; // 1 second at 30 FPS

/**
 * SlideTitle renders headlines with fade-underline animation
 */
export const SlideTitle: React.FC<SlideTitleProps> = ({
  headline,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();

  const fadeInDuration = FADE_DURATION_FRAMES;
  const fadeOutStart = durationInFrames - FADE_DURATION_FRAMES;

  // Text opacity
  const textOpacity =
    frame < fadeInDuration
      ? interpolate(frame, [0, fadeInDuration], [0, 1], { extrapolateRight: 'clamp' })
      : frame < fadeOutStart
      ? 1
      : interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], { extrapolateRight: 'clamp' });

  // Underline animation
  let underlineScale: number;
  let underlineOrigin: string;

  if (frame < fadeInDuration) {
    underlineScale = interpolate(frame, [0, fadeInDuration], [0, 1], { extrapolateRight: 'clamp' });
    underlineOrigin = 'left';
  } else if (frame < fadeOutStart) {
    underlineScale = 1;
    underlineOrigin = 'left';
  } else {
    underlineScale = interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], { extrapolateRight: 'clamp' });
    underlineOrigin = 'right';
  }

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: '110px',
          left: '60px',
          right: '60px',
          opacity: textOpacity,
        }}
      >
        <h2
          style={{
            fontSize: '52px',
            lineHeight: '1.2',
            fontWeight: 'bold',
            color: 'white',
            textShadow: '2px 2px 8px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.6)',
            marginBottom: '12px',
            textAlign: 'center',
          }}
        >
          {headline}
        </h2>
        <div
          style={{
            height: '4px',
            backgroundColor: '#FFD700',
            transformOrigin: underlineOrigin,
            transform: `scaleX(${underlineScale})`,
            boxShadow: '0 0 10px rgba(255, 215, 0, 0.6)',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
