# Master Orchestrator Output — SARTA Store Pages Redesign

## Analysis

SARTA needs 4 structural changes to match Zara editorial luxury pattern:

1. **Header/Nav** — structural + design (mega-menu overlay, category tabs, editorial images)
2. **Shop layout** — structural (remove sidebar, top filter bar, 4-col grid)  
3. **ProductCard** — CSS only (4:5 ratio, flush meta, no editorial-span)
4. **ProductPage** — layout fix (60/40 split, sticky gallery, no poster-hero)

## Domain routing

- **design-orchestrator (Antigravity)**: Define exact design spec — spacing, nav structure, mega-menu layout details, typography scale.
- **implementation-orchestrator (Codex)**: Implement all 4 components based on design spec.

## Dependency

Codex waits for Antigravity design spec before implementing.

```json
{
  "spawn-tasks": [
    {
      "role": "design-orchestrator",
      "provider": "antigravity",
      "title": "SARTA Zara-pattern design spec",
      "brief": "You are designing the UI spec for SARTA luxury fashion store pages. SARTA brand: dark editorial, Bodoni/Cormorant fonts, black/white/cream palette.\n\nZara reference patterns (already researched):\n- Header: hamburger(left) | LOGO-center | SEARCH + BAG[00](right). Transparent over hero, black bg on scroll.\n- Mega menu: full-screen overlay. Left: category tabs in large serif type (WOMAN / MAN / KIDS / BAGS / ACCESSORIES). Center: numbered sections '01 NEW IN' / '02 TRENDS' / '03 COLLECTION' each with 3-4 sub-links in smaller type. Right: editorial product images (3 stacked). Far right: BAG / LOG IN / HELP vertical.\n- Shop: NO sidebar. Top bar: FILTERS button | product count | SORT BY select. 4-col grid, gap 1px, cards edge-to-edge. No container padding on grid.\n- ProductCard: aspect-ratio 4/5, image fills card, name in 11px uppercase tracking-widest below, price in 11px below name. Tag: absolute top-left 10px 10px, uppercase 9px.\n- ProductPage: 60% left (image gallery, sticky), 40% right (info). No hero. Breadcrumb at top of right panel.\n\nSARTA tokens: --ink: #000, --bg: #fff, --muted: #666, --line: #e5e5e5\n\nOutput a complete design-spec.md covering:\n1. Header exact measurements (height, logo size, hamburger icon style, transition)\n2. Mega menu exact layout (overlay z-index, animation, column widths, type sizes for each level)\n3. Shop filter bar (height, button style, typography)\n4. Grid spec (columns, gap, responsive breakpoints)\n5. ProductCard exact measurements (aspect ratio, padding, font sizes, tag position)\n6. ProductPage layout (column widths, sticky behavior, spacing)\n\nOutput format: markdown spec. Then end with:\n```json\n{\"spawn-tasks\": []}\n```\n(No further sub-tasks needed from design.)"
    },
    {
      "role": "implementation-orchestrator",
      "provider": "codex",
      "title": "SARTA pages implementation — Header + Shop + ProductCard + ProductPage",
      "brief": "You are implementing 4 components for SARTA luxury fashion store (React + Vite + TypeScript). Base your implementation on the design-orchestrator output (design-spec.md from Antigravity).\n\nFiles to rewrite:\n1. src/components/layout/Header.tsx — Zara-style: hamburger(left) + LOGO-center + SEARCH+BAG(right). Full-screen mega-menu overlay with category tabs (WOMAN/MAN/KIDS/BAGS/ACCESSORIES), numbered sections (01 NEW IN / 02 TRENDS / 03 COLLECTION), editorial images right column.\n2. src/components/layout/Header.css — all styles\n3. src/features/shop/Shop.tsx — REMOVE sidebar (aside block). ADD top filter bar with FILTERS button + count + SORT BY. Grid becomes 4-col full-width.\n4. src/features/shop/Shop.css — 4-col grid, top filter bar styles\n5. src/features/product/ProductCard.tsx — keep logic, fix: aspect-ratio 4/5, flush meta below\n6. src/features/product/ProductCard.css — 4:5 ratio, image fills card, meta flush\n7. src/features/product/ProductPage.tsx — REMOVE zara-poster-hero section, implement 60/40 layout (sticky gallery left, info right)\n8. src/features/product/ProductPage.css — 60/40 split\n\nConstraints:\n- Keep all existing React logic (useCart, useParams, filters, sort, size/color selectors, addItem)\n- Keep existing data model (products.ts unchanged)\n- Keep App.tsx routing unchanged\n- Keep CustomCursor, Preloader components unchanged\n- SARTA design tokens: --ink, --bg, --muted, --line\n- Categories: all/new/women/men/bags/accessories (already in products.ts)\n- TypeScript strict — no any, no ts-ignore\n\nOutput all files. End with:\n```json\n{\"spawn-tasks\": []}\n```"
    }
  ]
}
```
