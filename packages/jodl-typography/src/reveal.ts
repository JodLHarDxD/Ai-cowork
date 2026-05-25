/**
 * @jodl/typography — text reveal configs
 * GSAP-based text animation configs. Use with SplitText or manual char splitting.
 * Import config, pass to gsap.from(chars, config.visible)
 */

import { duration, ease, stagger } from "@jodl/tokens/motion";

export type RevealConfig = {
  split: "chars" | "words" | "lines";
  hidden: Record<string, unknown>;
  visible: Record<string, unknown>;
  stagger: Record<string, unknown>;
};

// Char-by-char rise (luxury, editorial headlines)
export const charRise: RevealConfig = {
  split: "chars",
  hidden:  { opacity: 0, y: "120%", rotateX: -30 },
  visible: { opacity: 1, y: "0%",   rotateX: 0, duration: duration.slow.s, ease: ease.luxury.gsap },
  stagger: stagger.cascade,
};

// Word fade up (body text, captions)
export const wordFadeUp: RevealConfig = {
  split: "words",
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, duration: duration.slow.s, ease: ease.editorial.gsap },
  stagger: stagger.normal,
};

// Line slide in (editorial paragraphs)
export const lineSlide: RevealConfig = {
  split: "lines",
  hidden:  { opacity: 0, x: -32 },
  visible: { opacity: 1, x: 0, duration: duration.slower.s, ease: ease.editorial.gsap },
  stagger: stagger.slow,
};

// Scramble (reveal through character noise — kinetic, tech feel)
// Requires GSAP TextPlugin or ScrambleTextPlugin
export const scramble = {
  split: "chars" as const,
  chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%",
  speed: 0.4,
  duration: duration.slowest.s,
  ease: ease.linear.gsap,
};
