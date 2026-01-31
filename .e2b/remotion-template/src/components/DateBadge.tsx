/**
 * DateBadge Component
 * Displays animated date badge with fade-in effect
 * Format: DD MMM YYYY (e.g., "29 DEC 2025")
 */

import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

interface DateBadgeProps {
  date: string; // ISO string or Yahoo format like "12/29(月) 11:03"
  durationInFrames?: number;
}

const ANIMATION_DURATION_FRAMES = 30; // 1 second at 30 FPS

/**
 * DateBadge displays a horizontal date badge with fade-in animation
 */
export const DateBadge: React.FC<DateBadgeProps> = ({
  date,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();

  // Parse date and extract day, month, year
  const parseDate = (dateString: string): { day: string; month: string; year: string } => {
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
  };

  const { day, month, year } = parseDate(date);

  // Fade-in animation
  const opacity = interpolate(frame, [0, ANIMATION_DURATION_FRAMES], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          opacity,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '8px',
          padding: '12px 24px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
      >
        {/* Day */}
        <div
          style={{
            fontSize: '28px',
            lineHeight: '1',
            fontWeight: 'bold',
            color: 'white',
            textAlign: 'center',
          }}
        >
          {day}
        </div>

        {/* Month */}
        <div
          style={{
            fontSize: '28px',
            lineHeight: '1',
            fontWeight: '600',
            color: 'white',
            textAlign: 'center',
            letterSpacing: '1px',
          }}
        >
          {month}
        </div>

        {/* Year */}
        <div
          style={{
            fontSize: '28px',
            lineHeight: '1',
            fontWeight: '500',
            color: 'white',
            textAlign: 'center',
            opacity: 0.9,
          }}
        >
          {year}
        </div>
      </div>
    </AbsoluteFill>
  );
};
