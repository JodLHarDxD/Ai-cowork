# uiux-master — Knowledge Pack

Curated rules from reference sites + proven SARTA outcomes.

## Luxury fashion ecommerce rules

1. **Space is signal.** Luxury = restraint. Dense = cheap. Default: whitespace heavy.
2. **One typeface per role.** Display serif for headlines. Clean sans for body. Never swap.
3. **Motion deceleration only.** Luxury items don't rush. Ease-out, expo.inOut — never bounce.
4. **Image leads, text follows.** Full-bleed image → then type. Never type competing with image.
5. **Sound is optional.** Web Audio API ambience accepted in luxury. Never autoplay video sound.
6. **Preloader = brand primer.** Not a spinner. Editorial images + wordmark. Sets expectation.
7. **Cart drawer, never cart page.** Cart page interrupts flow. Drawer keeps context.
8. **Product grid: 2-3 items wide max.** Luxury items demand space. Grid-4+ = mass market signal.
9. **Color: near-monochrome + one accent.** Black/white/warm neutral + gold/copper accent. Enough.
10. **No component libraries.** Every element custom. Recognizable design system = mass market.

## Motion rules (from SARTA + awwwards reference)

1. **Entry: luxury ease.** `cubic-bezier(0.85, 0, 0.15, 1)` — slow start, slow end. Never linear.
2. **Stagger chars for headlines.** Word-level stagger for body. Never line-level for display.
3. **Lenis duration: 1.2–2.0s.** Slower than default. Cinematic scroll.
4. **Scroll-driven parallax: max 30% shift.** Over 30% = vertigo. Under 10% = invisible.
5. **Reduced motion: always.** All GSAP: check `prefersReducedMotion` from `@jodl/tokens/motion`.

## Typography rules (from editorial references)

1. **Display type: 80px+ on desktop.** Less = decorative, not editorial.
2. **Line height: tight for display (1.0–1.1), relaxed for body (1.6–1.8).**
3. **Letter spacing: tight for serif (-0.02em), normal for sans, wide for caps.**
4. **Font weight contrast.** Display: 400 or 700, never 500. Body: 300–400. Never match.
5. **Text reveal: always clip.** `overflow: hidden` on container. Char rises from below — invisible until revealed.
