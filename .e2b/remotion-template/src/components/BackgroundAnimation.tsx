/**
 * BackgroundAnimation - Ken Burns zoom effects
 */

import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import type { ZoomDirection } from '../types';

interface BackgroundAnimationProps {
  zoomDirection: ZoomDirection;
  durationInFrames: number;
  children: React.ReactNode;
}

/**
 * BackgroundAnimation wraps the background image and applies
 * Ken Burns zoom effect (zoom in or zoom out)
 */
export const BackgroundAnimation: React.FC<BackgroundAnimationProps> = ({
  zoomDirection,
  durationInFrames,
  children,
}) => {
  const frame = useCurrentFrame();

  // Ken Burns zoom: 1.0 to 1.2 scale
  const maxZoom = 1.2;
  const scaleStart = zoomDirection === 'in' ? 1.0 : maxZoom;
  const scaleEnd = zoomDirection === 'in' ? maxZoom : 1.0;

  const scale = interpolate(frame, [0, durationInFrames], [scaleStart, scaleEnd], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${scale})`,
      }}
    >
      {children}
    </div>
  );
};
