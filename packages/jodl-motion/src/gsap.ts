/**
 * @jodl/motion — gsap presets
 * Named animation configs ready to pass to gsap.to() / gsap.from() / gsap.fromTo()
 * All durations + easings sourced from @jodl/tokens/motion
 */

import { duration, ease, stagger, delay, prefersReducedMotion } from "@jodl/tokens/motion";

// Fade up — most common reveal
export const fadeUp = {
  hidden:  { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    duration: prefersReducedMotion ? 0 : duration.slow.s,
    ease: ease.luxury.gsap,
  },
} as const;

// Fade in — no movement, pure opacity
export const fadeIn = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    duration: prefersReducedMotion ? 0 : duration.normal.s,
    ease: ease.smooth.gsap,
  },
} as const;

// Slide in from right (cart drawer, panels)
export const slideInRight = {
  hidden:  { x: "100%", opacity: 0 },
  visible: {
    x: "0%",
    opacity: 1,
    duration: prefersReducedMotion ? 0 : duration.slow.s,
    ease: ease.editorial.gsap,
  },
} as const;

// Slide in from left
export const slideInLeft = {
  hidden:  { x: "-100%", opacity: 0 },
  visible: {
    x: "0%",
    opacity: 1,
    duration: prefersReducedMotion ? 0 : duration.slow.s,
    ease: ease.editorial.gsap,
  },
} as const;

// Magnetic hover (requires per-element event binding — see hooks/useMagnetic)
export const magnetic = {
  strength: 0.3,
  duration: duration.fast.s,
  ease: ease.snap.gsap,
} as const;

// Stagger presets — pass to gsap stagger option
export { stagger, delay, duration, ease };
