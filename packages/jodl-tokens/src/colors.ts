/**
 * @jodl/tokens — colors
 * Brand-agnostic color primitives. Projects layer brand tokens on top.
 * CSS custom properties generated from these at build time.
 */

// Neutral scale (perceptually uniform)
export const neutral = {
  0: "#ffffff",
  50: "#f9f9f7",
  100: "#f0ede8",
  200: "#e0dbd3",
  300: "#c8c0b5",
  400: "#a89e91",
  500: "#8a7f72",
  600: "#6e6357",
  700: "#52483e",
  800: "#383028",
  900: "#201b14",
  950: "#110e09",
  1000: "#000000",
} as const;

// Ink / paper duality (luxury default)
export const ink = {
  light: neutral[1000],   // text on light bg
  dark: neutral[0],       // text on dark bg
} as const;

// Brand accent placeholders — overridden per project via CSS custom properties
export const accent = {
  primary: "var(--jodl-accent-primary, #c8a96e)",
  secondary: "var(--jodl-accent-secondary, #8b6914)",
  surface: "var(--jodl-surface, #f9f9f7)",
  canvas: "var(--jodl-canvas, #111111)",
} as const;

// Status colors (shared across all projects)
export const status = {
  error: "#c0392b",
  warning: "#e67e22",
  success: "#27ae60",
  info: "#2980b9",
} as const;

export type ColorScale = typeof neutral;
export type AccentTokens = typeof accent;
