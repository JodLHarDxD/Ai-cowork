/**
 * @jodl/tokens — spacing
 * 4px base grid. Named steps match Tailwind conventions for familiarity.
 */

export const spacing = {
  0:    "0px",
  px:   "1px",
  0.5:  "2px",
  1:    "4px",
  1.5:  "6px",
  2:    "8px",
  2.5:  "10px",
  3:    "12px",
  3.5:  "14px",
  4:    "16px",
  5:    "20px",
  6:    "24px",
  7:    "28px",
  8:    "32px",
  9:    "36px",
  10:   "40px",
  11:   "44px",
  12:   "48px",
  14:   "56px",
  16:   "64px",
  20:   "80px",
  24:   "96px",
  28:   "112px",
  32:   "128px",
  36:   "144px",
  40:   "160px",
  48:   "192px",
  56:   "224px",
  64:   "256px",
  72:   "288px",
  80:   "320px",
  96:   "384px",
} as const;

// Named editorial spacing (luxury/fashion context)
export const editorialSpacing = {
  gutter:      spacing[8],    // 32px — content side margin
  gutterWide:  spacing[20],   // 80px — desktop side margin
  section:     spacing[40],   // 160px — between major sections
  block:       spacing[20],   // 80px — between content blocks
  element:     spacing[8],    // 32px — between related elements
  tight:       spacing[4],    // 16px — within element group
} as const;

// Breakpoints
export const breakpoint = {
  sm:  "640px",
  md:  "768px",
  lg:  "1024px",
  xl:  "1280px",
  "2xl": "1536px",
  "3xl": "1920px",
} as const;

// Z-index scale
export const zIndex = {
  base:     0,
  raised:   10,
  dropdown: 100,
  sticky:   200,
  overlay:  300,
  modal:    400,
  toast:    500,
  cursor:   900,
  preloader: 1000,
} as const;
