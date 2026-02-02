/**
 * BackgroundAnimation - Ken Burns zoom effects
 * OPTIMIZED: Uses React.memo and useMemo to prevent memory leaks during long renders
 */

import React, { useMemo, memo } from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { centeredFlexContainer } from '../styles';
import type { ZoomDirection } from '../types';

interface BackgroundAnimationProps {
  zoomDirection: ZoomDirection;
  durationInFrames: number;
  children: React.ReactNode;
}

const MAX_ZOOM = 1.2;

/**
 * Memoized background animation to prevent re-renders when props haven't changed
 */
export const BackgroundAnimation = memo<BackgroundAnimationProps>(({
  zoomDirection,
  durationInFrames,
  children,
}) => {
  const frame = useCurrentFrame();

  // Memoize scale calculation (only recalculates when dependencies change)
  const scale = useMemo(() => {
    const scaleStart = zoomDirection === 'in' ? 1.0 : MAX_ZOOM;
    const scaleEnd = zoomDirection === 'in' ? MAX_ZOOM : 1.0;

    return interpolate(frame, [0, durationInFrames], [scaleStart, scaleEnd], {
      extrapolateRight: 'clamp',
    });
  }, [frame, zoomDirection, durationInFrames]);

  // Memoize transform style (only creates new object when scale changes)
  const containerStyle = useMemo(() => ({
    ...centeredFlexContainer,
    transform: `scale(${scale})`,
  }), [scale]);

  return (
    <div style={containerStyle}>
      {children}
    </div>
  );
});

BackgroundAnimation.displayName = 'BackgroundAnimation';
