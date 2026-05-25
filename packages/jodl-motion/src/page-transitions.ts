/**
 * @jodl/motion — page transition configs
 * Named transition presets. Integrate with React Router or Next.js router events.
 */

import { duration, ease } from "@jodl/tokens/motion";

export type TransitionConfig = {
  name: string;
  enter: Record<string, unknown>;
  exit: Record<string, unknown>;
  duration: number;
};

export const dissolve: TransitionConfig = {
  name: "dissolve",
  exit:  { opacity: 0, duration: duration.normal.s, ease: ease.smooth.gsap },
  enter: { opacity: 1, duration: duration.slow.s,   ease: ease.luxury.gsap },
  duration: duration.slow.ms,
};

export const curtain: TransitionConfig = {
  name: "curtain",
  exit:  { scaleY: 0, transformOrigin: "top", duration: duration.slow.s, ease: ease.editorial.gsap },
  enter: { scaleY: 1, transformOrigin: "bottom", duration: duration.slow.s, ease: ease.editorial.gsap },
  duration: duration.slow.ms,
};

export const slide: TransitionConfig = {
  name: "slide",
  exit:  { x: "-100%", duration: duration.slow.s, ease: ease.editorial.gsap },
  enter: { x: "0%",    duration: duration.slow.s, ease: ease.editorial.gsap },
  duration: duration.slow.ms,
};
