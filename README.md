# jodl-workspace

Monorepo. Shared component library + apps + intelligence layer.

```
packages/   ← shared libraries (used by every app)
apps/       ← SARTA, creat-studio, jodlxverse
tools/      ← jodl-cli (curate, embed, search, vendor)
```

## Stack
- pnpm workspaces
- Turborepo
- TypeScript 6 strict
- Vite (apps) + tsup (packages)

## Quick start
```bash
pnpm install
pnpm dev              # all apps in parallel
pnpm dev --filter=sarta
pnpm build
pnpm jodl <command>   # jodl-cli
```

## Packages
- `@jodl/tokens` — design tokens (colors, typography, spacing, motion)
- `@jodl/ui` — primitive components (Button, Card, Modal, Drawer)
- `@jodl/motion` — GSAP/Lenis presets, animation primitives
- `@jodl/typography` — font pairings, text reveal/highlight animations
- `@jodl/patterns` — composed patterns (CartDrawer, CheckoutFlow, ProductCard)
- `@jodl/hooks` — useCart, useAuth, useFetch, useIntersect, useSmoothScroll
- `@jodl/system` — knowledge graph, embeddings, agents (the brain)

## Apps
- `apps/sarta` — luxury fashion ecommerce
- `apps/creat-studio` — creative studio
- `apps/jodlxverse` — TBD

## Extract app as standalone
```bash
pnpm jodl vendor sarta D:\sarta-for-client
# detaches @jodl/* deps, vendors them inline, ready to push to its own git
```

## Related
- `D:\.agents\` — process memory (mistakes, patterns, handoffs)
- This monorepo — artifact library + apps
