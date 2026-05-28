# JODL

TypeScript monorepo — shared component library, apps, and multi-AI orchestration CLI.

> **Live blueprint** → [docs-blue-eight.vercel.app](https://docs-blue-eight.vercel.app)

---

## What is this

JODL is three things in one repo:

1. **Component library** — design tokens, primitives, motion presets, patterns, hooks — built for luxury-tier UI
2. **Apps** — SARTA (luxury fashion ecom), creat-studio, jodlxverse — all consuming `@jodl/*` packages
3. **Multi-AI orchestration** — a command-bus CLI where Claude, GPT, Gemini, and Codex agents claim tasks, run them, and hand off results without stepping on each other

---

## Stack

| Layer | Tool |
|---|---|
| Workspaces | pnpm 11 |
| Build pipeline | Turborepo 2 |
| Language | TypeScript 6 strict |
| App bundler | Vite |
| Package bundler | tsup |
| Runtime | Node ≥ 20 |

---

## Structure

```
packages/          @jodl/* shared libraries
apps/              SARTA · creat-studio · jodlxverse
tools/jodl-cli     intelligence + orchestration CLI
docs/              system blueprint (HTML)
```

---

## Packages

| Package | Purpose |
|---|---|
| `@jodl/tokens` | Design tokens — color, type, spacing, motion |
| `@jodl/ui` | Primitive components — Button, Card, Modal, Drawer |
| `@jodl/motion` | GSAP/Lenis presets, animation primitives |
| `@jodl/typography` | Font pairings, text reveal + highlight animations |
| `@jodl/patterns` | Composed patterns — CartDrawer, CheckoutFlow, ProductCard |
| `@jodl/hooks` | useCart, useAuth, useFetch, useIntersect, useSmoothScroll |
| `@jodl/system` | Component registry, knowledge graph, embeddings, agents |

---

## Apps

| App | Description |
|---|---|
| `apps/sarta` | Luxury fashion ecommerce (React + Vite + TS) |
| `apps/creat-studio` | Creative studio |
| `apps/jodlxverse` | TBD |

---

## CLI — `jodl`

```bash
pnpm jodl <command>
# or: node tools/jodl-cli/bin/jodl.js <command>
```

### Component intelligence

```bash
jodl search "luxury hero"              # semantic search over registry
jodl list --quality proven             # list components by tier
jodl compose "product page" \
  --context luxury-fashion             # compose a page from registry + graph
jodl feedback CartDrawer 5 \
  --outcome kept                       # rate a component (1-5)
jodl embed                             # rebuild embedding index (needs OPENAI_API_KEY)
jodl curate https://site.com \
  --type motion                        # harvest reference site into sources/
```

### Multi-AI orchestration (command bus)

```bash
jodl whoami                            # identify current agent + role
jodl next --dry-run                    # peek at next task without claiming
jodl claim <taskId>                    # atomic claim — prints brief + context
jodl submit <taskId> --file <path>     # mark done + spawn children
jodl status                            # show bus state
jodl watch                             # live dashboard
```

### Agent execution

```bash
jodl agent list                        # list available domain agents
jodl agent run <name> --brief "..."    # call agent via LLM (needs ANTHROPIC_API_KEY)
```

### Vendor extraction

```bash
jodl vendor sarta D:\sarta-for-client  # extract app as standalone
                                       # detaches @jodl/* deps, vendors inline
```

---

## Quick start

```bash
pnpm install
pnpm dev                               # all apps in parallel
pnpm dev --filter=sarta                # single app
pnpm build
pnpm typecheck
```

---

## Multi-AI orchestration

JODL includes a command bus for coordinating multiple AI agents on the same codebase. Each agent declares a role (`implementation-orchestrator`, `frontend-master`, `backend-master`, etc.), claims tasks atomically, and submits results that can spawn child tasks.

Supported providers: Claude · GPT · Gemini · Codex

See the [full system blueprint](https://docs-blue-eight.vercel.app) for architecture diagrams.

---

## Environment variables

| Variable | Required for |
|---|---|
| `ANTHROPIC_API_KEY` | `jodl agent run` + Claude provider |
| `OPENAI_API_KEY` | `jodl embed` |

---

## License

Private.
