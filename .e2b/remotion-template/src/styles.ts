/**
 * Shared style constants to avoid creating new objects on every render
 * This prevents memory leaks from inline style allocations during long renders
 */

import { CSSProperties } from 'react';

// ============ AbsoluteFill Styles ============
export const absoluteFillBlack: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundColor: 'black',
} as const;

export const absoluteFillHidden: CSSProperties = {
  ...absoluteFillBlack,
  overflow: 'hidden',
} as const;

export const absoluteFillPointerEventsNone: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
} as const;

// ============ Image Styles ============
export const fullCoverImage: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
} as const;

// ============ Background Animation Styles ============
export const centeredFlexContainer: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;

// ============ Slide Title Styles ============
export const headlineContainer: CSSProperties = {
  position: 'absolute',
  top: '110px',
  left: '60px',
  right: '60px',
} as const;

export const headlineText: CSSProperties = {
  fontSize: '52px',
  lineHeight: '1.2',
  fontWeight: 'bold',
  color: 'white',
  textShadow: '2px 2px 8px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.6)',
  marginBottom: '12px',
  textAlign: 'center',
} as const;

export const headlineUnderline: CSSProperties = {
  height: '4px',
  backgroundColor: '#FFD700',
  boxShadow: '0 0 10px rgba(255, 215, 0, 0.6)',
} as const;

// ============ Date Badge Styles ============
export const dateBadgeContainer: CSSProperties = {
  position: 'absolute',
  top: '32px',
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  border: '2px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '8px',
  padding: '12px 24px',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
} as const;

export const dateBadgeText: CSSProperties = {
  fontSize: '28px',
  lineHeight: '1',
  color: 'white',
  textAlign: 'center',
} as const;

export const dateBadgeTextBold: CSSProperties = {
  ...dateBadgeText,
  fontWeight: 'bold',
} as const;

export const dateBadgeTextSemibold: CSSProperties = {
  ...dateBadgeText,
  fontWeight: '600',
  letterSpacing: '1px',
} as const;

export const dateBadgeTextMedium: CSSProperties = {
  ...dateBadgeText,
  fontWeight: '500',
  opacity: 0.9,
} as const;
