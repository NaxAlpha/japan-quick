/**
 * Japan Quick Design System
 * Tokyo Editorial Cyber-Industrial
 *
 * A distinctive fusion of bold editorial typography, high-contrast monochrome,
 * electric red accents, and subtle Japanese design influences.
 */

// ============================================================================
// FONTS - Import distinctive display and body fonts
// ============================================================================

export const fontImports = `
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Zen+Tokyo+Zoo&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Inter:wght@400;500;600;700&display=swap');
`;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const Typography = {
  // Display font - bold Japanese-inspired display
  display: "'Zen Tokyo Zoo', system-ui, sans-serif",

  // Body font - clean sans with Japanese character support
  body: "'Inter', 'Noto Sans JP', system-ui, sans-serif",

  // Monospace for data/technical elements
  mono: "'Space Mono', 'Courier New', monospace",

  // Sizes
  size: {
    display: 'clamp(2.5rem, 8vw, 5rem)',
    h1: 'clamp(1.75rem, 5vw, 2.5rem)',
    h2: 'clamp(1.25rem, 3vw, 1.75rem)',
    h3: 'clamp(1rem, 2.5vw, 1.25rem)',
    body: 'clamp(0.875rem, 2vw, 1rem)',
    small: 'clamp(0.75rem, 1.5vw, 0.875rem)',
    tiny: '0.6875rem',
  },

  // Weights
  weight: {
    display: 400,
    bold: 700,
    black: 900,
  },

  // Line heights
  leading: {
    tight: '1.1',
    normal: '1.5',
    relaxed: '1.75',
  },
};

// ============================================================================
// COLORS - High contrast monochrome with electric red
// ============================================================================

export const Colors = {
  // Base neutrals
  charcoal: '#0a0a0a',
  charcoalLight: '#1a1a1a',

  offWhite: '#f5f3f0',      // Warm off-white, like traditional paper
  white: '#ffffff',

  gray: {
    50: '#f5f3f0',
    100: '#e8e6e1',
    200: '#d4d0c8',
    300: '#a8a49c',
    400: '#78746c',
    500: '#58544c',
    600: '#403c34',
    700: '#282420',
    800: '#1a1a1a',
    900: '#0a0a0a',
  },

  // Electric red accent (inspired by Japanese flag but bolder)
  red: {
    base: '#e63946',
    bright: '#ff4d5a',
    dark: '#c1121f',
    glow: 'rgba(230, 57, 70, 0.3)',
  },

  // Subtle accent colors for status
  accent: {
    blue: '#0066cc',
    green: '#2d6a4f',
    yellow: '#e9c46a',
    purple: '#6b4c9a',
  },
};

// ============================================================================
// SPACING - Consistent scale
// ============================================================================

export const Spacing = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '3rem',    // 48px
  '3xl': '4rem',    // 64px
};

// ============================================================================
// PATTERNS - Japanese geometric patterns
// ============================================================================

export const Patterns = {
  // Simplified seigaiha (wave) pattern
  seigaiha: `
    background-color: ${Colors.offWhite};
    background-image: url("data:image/svg+xml,%3Csvg width='100' height='50' viewBox='0 0 100 50' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 25 Q 12.5 12.5, 25 25 T 50 25 T 75 25 T 100 25' stroke='%23d4d0c8' stroke-width='1' fill='none' opacity='0.3'/%3E%3C/svg%3E");
    background-size: 100px 50px;
  `,

  // Diagonal stripe pattern
  diagonal: `
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(230, 57, 70, 0.03) 10px,
      rgba(230, 57, 70, 0.03) 11px
    );
  `,

  // Grid pattern
  grid: `
    background-image:
      linear-gradient(rgba(230, 57, 70, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(230, 57, 70, 0.03) 1px, transparent 1px);
    background-size: 20px 20px;
  `,
};

// ============================================================================
// SHADOWS - Brutalist, sharp shadows
// ============================================================================

export const Shadows = {
  sm: '2px 2px 0 rgba(10, 10, 10, 1)',
  md: '4px 4px 0 rgba(10, 10, 10, 1)',
  lg: '8px 8px 0 rgba(10, 10, 10, 1)',

  glow: '0 0 20px rgba(230, 57, 70, 0.4)',
  glowSubtle: '0 0 10px rgba(230, 57, 70, 0.2)',

  inner: 'inset 2px 2px 4px rgba(0, 0, 0, 0.1)',
};

// ============================================================================
// BORDERS - Sharp edges, few rounded corners
// ============================================================================

export const Borders = {
  none: '0',
  thin: '1px solid rgba(10, 10, 10, 1)',
  medium: '2px solid rgba(10, 10, 10, 1)',
  thick: '3px solid rgba(10, 10, 10, 1)',

  rounded: '4px',
  pill: '9999px',
};

// ============================================================================
// ANIMATIONS - Subtle, intentional motion
// ============================================================================

export const Animations = {
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,

  slideUp: `
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,

  glitch: `
    @keyframes glitch {
      0% { transform: translate(0); }
      20% { transform: translate(-2px, 2px); }
      40% { transform: translate(-2px, -2px); }
      60% { transform: translate(2px, 2px); }
      80% { transform: translate(2px, -2px); }
      100% { transform: translate(0); }
    }
  `,

  pulse: `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  `,

  marquee: `
    @keyframes marquee {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
  `,
};

// ============================================================================
// MIXINS - Reusable style combinations
// ============================================================================

export const Mixins = {
  // Container with max width
  container: `
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 ${Spacing.lg};
  `,

  // Card base style
  card: `
    background: ${Colors.white};
    border: ${Borders.thin};
    box-shadow: ${Shadows.sm};
    transition: all 0.15s ease-out;
  `,

  // Button base style
  button: `
    font-family: ${Typography.body};
    font-weight: 600;
    font-size: ${Typography.size.small};
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.75rem 1.5rem;
    border: ${Borders.medium};
    background: ${Colors.charcoal};
    color: ${Colors.white};
    cursor: pointer;
    box-shadow: ${Shadows.sm};
    transition: all 0.15s ease-out;
  `,

  // Badge/label style
  badge: `
    font-family: ${Typography.mono};
    font-size: ${Typography.size.tiny};
    font-weight: 400;
    padding: 0.25rem 0.625rem;
    border: 1px solid ${Colors.charcoal};
    text-transform: uppercase;
    letter-spacing: 0.05em;
  `,

  // Heading style
  heading: `
    font-family: ${Typography.display};
    font-weight: ${Typography.weight.display};
    line-height: ${Typography.leading.tight};
    color: ${Colors.charcoal};
    text-transform: uppercase;
    letter-spacing: 0.02em;
  `,
};
