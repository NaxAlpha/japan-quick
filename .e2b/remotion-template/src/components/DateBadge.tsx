/**
 * DateBadge Component
 * Displays animated date badge with fade-in effect
 * Format: DD MMM YYYY (e.g., "29 DEC 2025")
 * OPTIMIZED: Uses React.memo and useMemo to prevent memory leaks during long renders
 */

import React, { useMemo, memo } from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';
import { dateBadgeContainer, dateBadgeTextBold, dateBadgeTextSemibold, dateBadgeTextMedium } from '../styles';

interface DateBadgeProps {
  date: string; // ISO string or Yahoo format like "12/29(月) 11:03"
  durationInFrames?: number;
}

const ANIMATION_DURATION_FRAMES = 30; // 1 second at 30 FPS

/**
 * Parse date once and cache the result
 */
function parseDate(dateString: string): { day: string; month: string; year: string } {
  let parsedDate: Date;

  // Try to parse Yahoo format first: "12/29(月) 11:03"
  const yahooMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})/);
  if (yahooMatch) {
    const [, month, day] = yahooMatch;
    const currentYear = new Date().getFullYear();
    parsedDate = new Date(currentYear, parseInt(month) - 1, parseInt(day));
  } else {
    // Try ISO format
    parsedDate = new Date(dateString);
  }

  // Validate date
  if (isNaN(parsedDate.getTime())) {
    // Fallback to current date if parsing fails
    parsedDate = new Date();
  }

  const day = parsedDate.getDate().toString();
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = monthNames[parsedDate.getMonth()];
  const year = parsedDate.getFullYear().toString();

  return { day, month, year };
}

/**
 * Memoized date badge to prevent re-renders when props haven't changed
 */
export const DateBadge = memo<DateBadgeProps>(({
  date,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();

  // Parse date once (memoized across renders)
  const { day, month, year } = useMemo(() => parseDate(date), [date]);

  // Memoize fade-in animation
  const opacity = useMemo(() => {
    return interpolate(frame, [0, ANIMATION_DURATION_FRAMES], [0, 1], { extrapolateRight: 'clamp' });
  }, [frame]);

  // Memoize container style with opacity
  const containerStyle = useMemo(() => ({
    ...dateBadgeContainer,
    opacity,
  }), [opacity]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={containerStyle}>
        {/* Day */}
        <div style={dateBadgeTextBold}>
          {day}
        </div>

        {/* Month */}
        <div style={dateBadgeTextSemibold}>
          {month}
        </div>

        {/* Year */}
        <div style={dateBadgeTextMedium}>
          {year}
        </div>
      </div>
    </AbsoluteFill>
  );
});

DateBadge.displayName = 'DateBadge';
