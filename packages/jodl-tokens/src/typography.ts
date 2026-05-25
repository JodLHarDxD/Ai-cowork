/**
 * @jodl/tokens — typography
 * Type scale, font stacks, line heights.
 * Fonts loaded per-project via @font-face or Google Fonts.
 */

// Font stacks
export const fontStack = {
  // Editorial serif — Bodoni, Cormorant, Playfair
  editorial: "var(--jodl-font-editorial, 'Cormorant Garamond', 'Bodoni Moda', Georgia, serif)",
  // Clean sans — Interface, Neue Haas, Inter
  sans: "var(--jodl-font-sans, 'Inter', 'Neue Haas Grotesk', system-ui, sans-serif)",
  // Mono — code, labels
  mono: "var(--jodl-font-mono, 'JetBrains Mono', 'Fira Code', monospace)",
  // Display — large hero text, can be same as editorial
  display: "var(--jodl-font-display, 'Bodoni Moda', 'Cormorant Garamond', serif)",
} as const;

// Type scale (rem, 4px base = 1rem assumption 16px)
export const typeScale = {
  xs:   "0.75rem",   //  12px
  sm:   "0.875rem",  //  14px
  base: "1rem",      //  16px
  md:   "1.125rem",  //  18px
  lg:   "1.25rem",   //  20px
  xl:   "1.5rem",    //  24px
  "2xl": "2rem",     //  32px
  "3xl": "2.5rem",   //  40px
  "4xl": "3rem",     //  48px
  "5xl": "4rem",     //  64px
  "6xl": "5rem",     //  80px
  "7xl": "6.25rem",  // 100px
  "8xl": "8rem",     // 128px
} as const;

// Line heights
export const lineHeight = {
  tight:   1.1,
  snug:    1.25,
  normal:  1.5,
  relaxed: 1.75,
  loose:   2,
} as const;

// Letter spacing
export const letterSpacing = {
  tighter: "-0.04em",
  tight:   "-0.02em",
  normal:  "0",
  wide:    "0.04em",
  wider:   "0.08em",
  widest:  "0.16em",
  caps:    "0.2em",
} as const;

// Font weights
export const fontWeight = {
  thin:       100,
  extralight: 200,
  light:      300,
  regular:    400,
  medium:     500,
  semibold:   600,
  bold:       700,
  extrabold:  800,
  black:      900,
} as const;

// Named pairings — each maps to registry entry in jodl-system
export const fontPairings = {
  "editorial-luxury":    { display: fontStack.editorial, body: fontStack.sans },
  "tech-minimal":        { display: fontStack.sans,      body: fontStack.sans },
  "editorial-mono":      { display: fontStack.editorial, body: fontStack.mono },
  "brutalist":           { display: fontStack.sans,      body: fontStack.mono },
} as const;

export type FontStack = typeof fontStack;
export type TypeScale = typeof typeScale;
