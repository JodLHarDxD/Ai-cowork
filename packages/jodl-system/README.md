# @jodl/system — Intelligence Layer

The brain of jodl-workspace. Not a UI library. A knowledge system.

## Structure

```
sources/          ← raw harvests from reference sites (read-only after capture)
patterns/         ← curated, synthesized, cross-referenced
  typography/     ← font pairings, text animations
  motion/         ← animation presets, timing systems
  layouts/        ← hero, grid, editorial, masonry
  ecommerce/      ← cart, checkout, product patterns
  editorial/      ← drag gallery, lookbook, kinetic
graph/            ← relationships (pairings, conflicts, lineage)
embeddings/       ← sqlite vector DB (semantic search)
agents/           ← domain-specialized agent configs
  uiux-master/
  frontend-master/
  motion-master/
  typography-master/
  backend-master/
feedback/         ← output log + ratings (self-improvement input)
registry/         ← JSON index (AI queries this to compose pages)
scripts/          ← curate, embed, search, feedback, vendor CLIs
```

## How patterns enter

```
1. Harvest: pnpm jodl curate --source <url> --type typography
2. Review: output goes to sources/<domain>/
3. Curate: manually assess, write _meta.yaml, create synthesis file
4. Register: pnpm jodl embed — adds to embeddings/patterns.sqlite + registry/
5. Grade: used in 2+ apps + rated >4/5 → confidence: proven
6. Garbage: patterns below threshold → pnpm jodl clean-garbage
```

## Quality gate checklist

Before any pattern gets `confidence: proven`:
- [ ] Visual — renders correctly, 3 viewports
- [ ] Code — no inline styles, uses @jodl/tokens only
- [ ] Motion — respects prefers-reduced-motion
- [ ] Accessibility — keyboard nav, aria
- [ ] Performance — GPU-composited animations
- [ ] Docs — usage example + props in _meta.yaml
- [ ] Registry — entry written in registry/components.json
- [ ] Embedded — pnpm embed run after adding

## Agent usage

Agents query this system at composition time:

```ts
import { search } from "@jodl/system";

const results = await search("luxury fashion hero with kinetic typography");
// → top 5 patterns by semantic similarity + graph pairings
```
