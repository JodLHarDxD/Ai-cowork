/**
 * @jodl/typography — text highlight animations
 * CSS + GSAP configs for underline draw, background sweep, outline glow.
 * Apply as className + trigger GSAP on scroll.
 */

// Underline draw — SVG path animation (draw from left to right)
export const underlineDraw = {
  css: {
    position: "relative",
    display: "inline-block",
    // Add ::after pseudo element with border-bottom and clip-path or scale
  },
  gsap: {
    // Target: element::after or SVG path
    hidden:  { scaleX: 0, transformOrigin: "left center" },
    visible: { scaleX: 1, duration: 0.6, ease: "power2.out" },
  },
} as const;

// Background color sweep (text-highlight effect)
export const backgroundSweep = {
  css: {
    backgroundImage: "linear-gradient(var(--highlight-color, #c8a96e), var(--highlight-color, #c8a96e))",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "0 100%",
  },
  gsap: {
    hidden:  { backgroundSize: "0% 2px" },
    visible: { backgroundSize: "100% 2px", duration: 0.8, ease: "power2.out" },
  },
} as const;

// Full fill (text becomes selection-highlighted)
export const backgroundFill = {
  gsap: {
    hidden:  { backgroundSize: "0% 100%" },
    visible: { backgroundSize: "100% 100%", duration: 0.6, ease: "expo.out" },
  },
} as const;
