/**
 * @jodl/motion — lenis smooth scroll configs
 * Import and pass to new Lenis() constructor
 */

export type LenisConfig = {
  duration?: number;
  easing?: (t: number) => number;
  smoothWheel?: boolean;
  touchMultiplier?: number;
  infinite?: boolean;
};

// Default luxury smooth scroll
export const lenisDefault: LenisConfig = {
  duration: 1.2,
  easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  touchMultiplier: 2,
  infinite: false,
};

// Fast — tech/SaaS feel
export const lenisFast: LenisConfig = {
  duration: 0.8,
  easing: (t: number) => 1 - Math.pow(1 - t, 3),
  smoothWheel: true,
  touchMultiplier: 1.5,
};

// Cinematic — editorial, slow pan
export const lenisCinematic: LenisConfig = {
  duration: 2.0,
  easing: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  smoothWheel: true,
  touchMultiplier: 2.5,
};
