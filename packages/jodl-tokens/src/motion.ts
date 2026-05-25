/**
 * @jodl/tokens — motion
 * Duration, easing, delay presets. Framework-agnostic.
 * Used by @jodl/motion to configure GSAP/CSS animations.
 */

// Duration (ms for CSS, seconds for GSAP — both exported)
export const duration = {
  instant:   { ms: 0,    s: 0 },
  fastest:   { ms: 80,   s: 0.08 },
  fast:      { ms: 150,  s: 0.15 },
  normal:    { ms: 300,  s: 0.3 },
  slow:      { ms: 500,  s: 0.5 },
  slower:    { ms: 800,  s: 0.8 },
  slowest:   { ms: 1200, s: 1.2 },
  cinematic: { ms: 2000, s: 2.0 },
} as const;

// Easing — CSS cubic-bezier + GSAP string
export const ease = {
  // General purpose
  linear:    { css: "linear",                       gsap: "none" },
  smooth:    { css: "cubic-bezier(0.4, 0, 0.2, 1)", gsap: "power2.inOut" },

  // Entry (decelerate)
  in:        { css: "cubic-bezier(0.0, 0.0, 0.2, 1)", gsap: "power2.out" },
  inStrong:  { css: "cubic-bezier(0.0, 0.0, 0.05, 1)", gsap: "power4.out" },

  // Exit (accelerate)
  out:       { css: "cubic-bezier(0.4, 0.0, 1, 1)", gsap: "power2.in" },
  outStrong: { css: "cubic-bezier(0.8, 0.0, 1, 1)", gsap: "power4.in" },

  // Expressive
  spring:    { css: "cubic-bezier(0.34, 1.56, 0.64, 1)", gsap: "back.out(1.7)" },
  editorial: { css: "cubic-bezier(0.76, 0, 0.24, 1)", gsap: "expo.inOut" },
  luxury:    { css: "cubic-bezier(0.85, 0, 0.15, 1)", gsap: "expo.inOut" },
  snap:      { css: "cubic-bezier(0.2, 0, 0, 1)",       gsap: "circ.out" },
} as const;

// Stagger presets (GSAP stagger config objects)
export const stagger = {
  fast:     { amount: 0.2, from: "start" as const },
  normal:   { amount: 0.4, from: "start" as const },
  slow:     { amount: 0.8, from: "start" as const },
  center:   { amount: 0.4, from: "center" as const },
  random:   { amount: 0.6, from: "random" as const },
  cascade:  { amount: 0.6, from: "start" as const, ease: "power2.inOut" },
} as const;

// Delay presets
export const delay = {
  none:    0,
  short:   0.1,
  normal:  0.2,
  medium:  0.4,
  long:    0.8,
  preload: 1.5,
} as const;

// Scroll trigger defaults
export const scrollTrigger = {
  start:        "top 85%",
  startEarly:   "top 95%",
  startLate:    "top 60%",
  startScrub:   "top top",
  endScrub:     "bottom top",
  markers:      false,
} as const;

// Reduced motion: detect + fallback
export const prefersReducedMotion =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

export type Duration = typeof duration;
export type Ease = typeof ease;
