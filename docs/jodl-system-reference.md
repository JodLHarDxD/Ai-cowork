# JODL System Reference

**Version:** as of 2026-05-29 · Branch: master · Latest commit: `11b04e8`
**Repo:** github.com/JodLHarDxD/Ai-cowork

---

## What JODL Is

JODL is a multi-AI orchestration protocol. Multiple AI models (Claude, Gemini, Codex) collaborate on software projects without a network service, shared database, or central daemon. The coordination primitive is a filesystem queue. Atomic file rename is the lock.

Three things make it work:

1. **Command Bus** — a directory of YAML files in `D:\.agents\command-bus\`. Tasks move through states by filename prefix: `pending-` → `claimed-<provider>-` → `done-`.
2. **Routing Matrix** — `D:\.agents\routing-matrix.yaml` maps every agent role to a provider and model. The CEO edits this file; the bus reads it.
3. **Shared Brain** — `D:\.agents\` holds mistakes, patterns, and staging notes. Every agent gets this context injected before its system prompt.

No API server. No cloud queue. No lock files. Works across Claude, Gemini, Codex, and any future model with a CLI.

---

## Repository Layout

```
d:\jodl-workspace\
├── packages\
│   ├── @jodl/tokens          Design tokens: colors, spacing, motion, typography
│   ├── @jodl/ui              Primitive React components
│   ├── @jodl/motion          GSAP + Lenis presets
│   ├── @jodl/typography      Font pairings + text reveal configs
│   ├── @jodl/patterns        Composed React patterns (promoted from apps)
│   ├── @jodl/hooks           Shared React hooks
│   └── @jodl/system          Agent prompts, routing, registry, graph, feedback
├── tools\
│   └── jodl-cli\             Command bus CLI (jodl daemon / next / brief / emit)
└── apps\
    ├── sarta\                 Luxury fashion ecommerce — React + Vite + TS
    ├── creat-studio\          Creative studio (placeholder)
    └── jodlxverse\            Stub (placeholder)
```

**Build system:** pnpm workspaces + Turborepo. TypeScript 6.0.3 throughout.

---

## The Command Bus

**Location:** `D:\.agents\command-bus\`

```
command-bus\
├── inbox\              (unused — reserved)
├── active\
│   └── sess-<id>\
│       ├── session.json
│       ├── brief.md
│       └── tasks\
│           ├── pending-<taskId>.yaml
│           ├── claimed-<provider>-<taskId>.yaml
│           └── done-<taskId>.yaml
├── done\               (completed sessions archived here)
└── events\             SYNAPSE event files
    └── <ts>-<TYPE>.json
```

### Task Lifecycle

```
pending-abc123.yaml
  → claimed-codex-abc123.yaml       (atomic rename — first writer wins)
  → done-abc123.yaml                (output written to abc123.out.md)
```

Two providers can race for the same task. The rename is atomic on Windows NTFS and POSIX. The loser gets `ENOENT` and retries.

### Task YAML Schema

```yaml
id: abc123
sessionId: sess-xyz
role: frontend-master
assignedProvider: codex
assignedModel: gpt-5
brief: |
  Implement ProductCard component using @jodl/patterns spec...
dependsOn: [def456]          # wait for these task ids first
phase: build                  # design | build | ship
parallelGroup: 2              # tasks with same number run concurrently
```

---

## Running the System

### Quick Start (three terminals)

```powershell
# Terminal 1 — Claude
$env:JODL_PROVIDER = "claude-code"
$env:ANTHROPIC_API_KEY = "sk-ant-..."
pnpm --filter @jodl/cli jodl daemon

# Terminal 2 — Gemini
$env:JODL_PROVIDER = "antigravity"
$env:GOOGLE_API_KEY = "..."
pnpm --filter @jodl/cli jodl daemon

# Terminal 3 — Codex
$env:JODL_PROVIDER = "codex"
$env:OPENAI_API_KEY = "sk-..."
pnpm --filter @jodl/cli jodl daemon

# Terminal 4 — submit a project
pnpm --filter @jodl/cli jodl brief "build a luxury ecommerce storefront for SARTA"
```

### Key CLI Commands

| Command | What it does |
|---|---|
| `jodl daemon` | Auto-claim loop. Runs until idle or `--max-tasks N`. |
| `jodl next` | Claim and run one task, then exit. |
| `jodl brief "..."` | Submit project brief → spawns master-orchestrator task. |
| `jodl status` | Show queue: pending / claimed / done per session. |
| `jodl emit TYPE domain [json]` | Broadcast a SYNAPSE event. |
| `jodl claim <taskId>` | Claim a task for manual execution (no API key needed). |
| `jodl submit <taskId> -f <file>` | Submit AI output for a manually claimed task. |
| `jodl next --dry-run` | Preview what's next without claiming. |
| `jodl next --force-reclaim <taskId>` | Return a stuck claimed task to pending. |
| `jodl whoami` | Show current provider + brain status. |

### Detach a Provider

```powershell
# In provider's terminal:
Ctrl+C    # kills daemon

# In chat, type /jodl-stop → I scan for stuck claimed-<provider>-*.yaml
# → give exact --force-reclaim commands
```

---

## Agent Hierarchy

### Tier 1 — Master Orchestrator

Receives CEO brief. Decides which domains are needed. Spawns domain orchestrators. Merges domain outputs. Reports decisions to CEO.

**Provider:** Claude Opus 4.7 · **Reason:** meta-reasoning over parallel outputs

### Tier 2 — Domain Orchestrators

Each orchestrator owns its sub-agents, plans within its domain, reports to master.

| Orchestrator | Domain | Provider | Model | Phase |
|---|---|---|---|---|
| design-orchestrator | UX, motion, typography, research | Gemini | gemini-1.5-pro | design |
| architecture-orchestrator | system arch, schema, conventions | Claude | claude-opus-4-7 | design |
| implementation-orchestrator | frontend + backend + database | Codex | gpt-5 | build |
| security-orchestrator | threat modeling, vulns, pentest | Claude | claude-opus-4-7 | ship |
| ship-orchestrator | reliability, legal, deploy | Codex | gpt-5 | ship |

### Tier 3 — Sub-Agents (Leaf Agents)

| Role | Provider | Model | Domain |
|---|---|---|---|
| research-master | Gemini | gemini-1.5-flash | design |
| uiux-master | Gemini | gemini-1.5-pro | design |
| motion-master | Gemini | gemini-3.5-flash | design |
| typography-master | Gemini | gemini-3.5-flash | design |
| architect | Claude | claude-opus-4-7 | architecture |
| schema-master | Claude | claude-sonnet-4-6 | architecture |
| style-guide | Gemini | gemini-3.5-flash | architecture |
| frontend-master | Codex | gpt-5 | implementation |
| backend-master | Codex | gpt-5 | implementation |
| database-master | Claude | claude-sonnet-4-6 | implementation |
| threat-modeler | Claude | claude-opus-4-7 | security |
| vuln-scanner | Claude | claude-sonnet-4-6 | security |
| pentest-simulator | Claude | claude-opus-4-7 | security |
| reliability-master | Codex | gpt-5 | ship |
| legal-master | Gemini | gemini-3.5-flash | ship |
| deploy-master | Claude | claude-sonnet-4-6 | ship |

### Phase Activation

```
design phase:  design-orchestrator ∥ architecture-orchestrator → CEO approval
build phase:   implementation-orchestrator (sequential) → CEO approval
ship phase:    security-orchestrator ∥ ship-orchestrator (manual CEO trigger)
```

### Spawn JSON Contract

Every orchestrator output **must** end with this block. The bus parses it to create child tasks. Missing or malformed = build stalls.

```json
{
  "phase": "design",
  "spawn-tasks": [
    {
      "role": "design-orchestrator",
      "brief": "Detailed brief...",
      "depends-on": [],
      "parallel-group": 1
    }
  ],
  "ceo-report": "One paragraph summary.",
  "ceo-decisions-needed": []
}
```

**Validation (as of commit 11b04e8):** the bus now logs a loud error and skips tasks missing `role` or `brief`. Unknown roles (not in routing-matrix.yaml) emit a warning and default to `claude-code`.

---

## System Prompt Composition

Every agent receives a composed system prompt built in this order:

```
1. AGENTS_BASE.md           Universal base (monorepo map, hard rules, spawn contract,
                             11 Codex anti-patterns)
2. agent/system-prompt.md   Role-specific instructions
3. Shared Brain             mistakes/ + patterns/ + staging/ (all injected)
4. Session context           Prior outputs from same session, scoped to agent's domain
5. Runtime Alerts            SYNAPSE event notes (if any)
```

### AGENTS_BASE.md

Located at `packages/jodl-system/agents/AGENTS_BASE.md`. Injected at layer 0. Contains:

- **Monorepo map** — every `@jodl/` package and its role
- **Hard rules** — `overflow-x: clip` not `hidden`, `inert: true` not `""`, `useCallback` on context callbacks, `prefersReducedMotion` guard on all GSAP
- **Spawn JSON contract** — one schema defined once for all orchestrators
- **11 Codex anti-patterns** — confirmed production bugs, quick checklist form

---

## SYNAPSE Events

Filesystem pub/sub for runtime signals. Location: `D:\.agents\command-bus\events\`.

### Event Types

| Type | When to emit | Effect |
|---|---|---|
| `API_RATE_LIMIT_WARNING` | Provider near limit | Adds `delayMs` back-off to tasks in that domain |
| `PROVIDER_UNAVAILABLE` | Provider goes down | Daemons for that provider return tasks to pending |
| `SCHEMA_DEPRECATION` | Breaking API change | Adds `notes` warning to relevant domain agents |
| `TASK_FAILED` | Task error logged | Informs other agents to avoid repeating the pattern |
| `CODEBASE_CHANGED` | Big refactor merged | Prompts agents to re-read structure before continuing |

### Emit from terminal

```powershell
# Provider unavailable
pnpm --filter @jodl/cli jodl emit PROVIDER_UNAVAILABLE all '{"provider":"codex"}'

# Rate limit
pnpm --filter @jodl/cli jodl emit API_RATE_LIMIT_WARNING implementation

# Schema change
pnpm --filter @jodl/cli jodl emit SCHEMA_DEPRECATION architecture '{"note":"ProductSchema v2"}'
```

### How Events Apply

1. Daemon reads pending events on each loop iteration
2. Filters to events relevant to current task's domain
3. Builds `RuntimeOverrides`: `maxTokens`, `delayMs`, `skipProviders`, `notes`
4. Event renamed `.json` → `.processed.json` (consumed — idempotent, same atomic trick as task claim)
5. If `skipProviders` includes this daemon's provider → task returned to pending, daemon sleeps

---

## The Shared Brain — D:\.agents

```
D:\.agents\
├── BRAIN.md                Master index (load this first every session)
├── routing-matrix.yaml     CEO's model routing overrides
├── jodl-runbook.md         Operational runbook
├── mistakes\               Confirmed failures — never repeat
│   ├── codex-react-implementation-patterns.md   11 Codex bugs from SARTA
│   ├── baseurl-deprecated-ts6.md                TS6 bundler + ignoreDeprecations
│   └── gstack-fullstack-miss.md                 Always invoke gstack for fullstack
├── patterns\               Proven solutions — 2+ sessions validated
│   ├── vite-ts-path-aliases.md                  @/ alias needs BOTH vite + tsconfig
│   ├── feature-based-architecture.md            features/ layout convention
│   ├── products-type-extraction.md              Type + re-export pattern
│   ├── jodl-forge-phase0-scan.md               Always scan before routing
│   └── model-routing-signals.md                [MODEL] ↑/↓ tag protocol
├── staging\                Learned once — needs 2+ sessions to graduate
│   ├── bus-brain-injection.md                   loadBrainContext() wiring
│   ├── lenis-version-windows-sqlite.md          lenis@^1.3.0, C++ tools for sqlite
│   ├── jodl-bus-multi-provider.md               Multi-provider + pnpm allowBuilds
│   └── synapse-events-layer.md                  SYNAPSE filesystem pub/sub
├── experiments\            Bold untested moves (write BEFORE the move)
├── handoffs\               End-of-session handoffs (newest first)
├── projects\               Per-project status files
├── models\                 Model capability routing table
└── provider-profiles\      Per-provider config
```

### Brain Protocol

**Read:** every session, scan `BRAIN.md` index, load only entries relevant to current task.

**Write tiers:**

```
experiments/  ← BEFORE any bold/risky code decision
staging/      ← any new learning (1 session)
mistakes/     ← 1 confirmed failure is enough
patterns/     ← promote from staging after 2+ sessions
```

**Always git commit after every brain write:**

```powershell
cd D:\.agents
git add -A
git commit -m "brain: <what changed and why>"
```

Brain is fully git-versioned. Wrong entry: `git log D:\.agents` → `git revert <sha>`.

---

## Design System Packages

### @jodl/tokens

Framework-agnostic design tokens.

| Export | Contents |
|---|---|
| `colors` | Ink, surface, brand, state colors |
| `spacing` | gutter, section, stack scales |
| `typeScale` | xs → 8xl (12px → 128px) |
| `fontStack` | editorial, sans, mono, display |
| `lineHeight` | tight (1.1) → loose (2) |
| `letterSpacing` | tighter (−0.04em) → caps (0.2em) |
| `duration` | instant → cinematic (0 → 2000ms) |
| `ease` | smooth, in, out, spring, editorial, luxury, snap |
| `stagger` | fast, normal, slow, center, random, cascade |
| `prefersReducedMotion` | boolean — always guard animations |

**Rule:** never hardcode. Import from `@jodl/tokens`.

### @jodl/motion

GSAP + Lenis presets. Import-ready named configs.

**Lenis configs:** `lenisDefault` (luxury, 1.2s), `lenisFast` (tech, 0.8s), `lenisCinematic` (editorial, 2.0s)

**GSAP presets:** `fadeUp`, `fadeIn`, `slideInRight`, `slideInLeft`, `magnetic`

**Critical:** `overflow-x: clip` on `html` and `body` — never `hidden`. `hidden` creates a new scroll container and breaks Lenis.

### @jodl/typography

Font pairings and text reveal configs.

**Pairings:**
- `editorial-luxury` — Cormorant Garamond + Inter · luxury, fashion, ecommerce
- `tech-minimal` — Inter + Inter · SaaS, dashboard, minimal
- `kinetic-display` — Bodoni Moda + Inter · fashion, editorial, motion-heavy

**Reveals:** `charRise` (luxury, char-by-char), `wordFadeUp` (editorial, word), `lineSlide` (lines), `scramble` (tech, kinetic)

### @jodl/system

Agent infrastructure:

```
agents\
├── AGENTS_BASE.md               Universal base prompt (injected first)
├── master-orchestrator\
├── design-orchestrator\
├── architecture-orchestrator\
├── implementation-orchestrator\
├── security-orchestrator\
├── ship-orchestrator\
├── frontend-master\             Hardened — 11 Codex anti-patterns checklist
├── backend-master\              Hardened — Supabase/Stripe/Zod patterns
├── motion-master\               Hardened — real exported names only
├── typography-master\           Hardened — real pairing slugs only
└── uiux-master\
registry\
├── components.json              Promoted/pending-promotion component registry
└── schema.json
graph\
├── pairings.json                Proven component pairings + conflicts
└── feedback.json                Task outcome scores (wired as of 11b04e8)
```

---

## Feedback Loop

`packages/jodl-system/graph/feedback.json` tracks task outcomes per role.

**Structure:**

```json
{
  "scores": {
    "frontend-master": { "uses": 12, "done": 11, "failed": 1 },
    "design-orchestrator": { "uses": 3, "done": 3, "failed": 0 }
  }
}
```

Written automatically on every `markTaskDone()` and execution failure. Provides data for identifying which agents need prompt improvement.

---

## Model Routing Signals

Every agent emits a signal when task complexity changes. These are for the human operator — they do not auto-switch models.

| Signal | Meaning |
|---|---|
| `[MODEL] sonnet fits → continue` | Current model is right |
| `[MODEL] ↑ opus suggested → reason` | Complex tradeoffs, consider upgrading |
| `[MODEL] ↑ opus required → reason` | Security-critical, long-chain reasoning |
| `[MODEL] ↓ drop to sonnet → reason` | Mechanical task, downgrade to save cost |

**Silent** when no change.

---

## Active Apps

### SARTA (`apps/sarta`)

Luxury B2C fashion ecommerce. React + Vite + TypeScript. Reference brand: Zara-pattern editorial luxury.

- Stack: React 18, Vite, TS, Lenis, GSAP, Supabase, Stripe
- Features: PDP, Shop, Cart drawer, Preloader, Header
- Design system: `editorial-luxury` pairing, `charRise` reveals, `lenisDefault`
- Status: UI complete, backend integration pending

### creat-studio (`apps/creat-studio`)

Creative studio project. Placeholder — not yet started.

### jodlxverse (`apps/jodlxverse`)

Stub placeholder.

---

## Slash Commands (in Claude chat)

| Command | What it does |
|---|---|
| `/jodl-status` | Read bus files, report sessions, tasks, stuck items |
| `/jodl-run` | Print exact startup commands for all three providers |
| `/jodl-stop` | Detach a provider — scan for stuck claimed tasks, give reclaim commands |
| `/jodl-event` | Walk through broadcasting a SYNAPSE event |
| `/jodl-kickoff` | Structured project discovery session (vision → style → scope → stack) |

---

## Operational Checklist

**Starting a session:**
1. Scan `D:\.agents\BRAIN.md` — load relevant entries
2. Check `D:\.agents\handoffs\` — read most recent handoff for current project
3. Set `JODL_PROVIDER` in each terminal
4. Run `jodl daemon` in each provider terminal

**Ending a session:**
1. Write handoff to `D:\.agents\handoffs\<date>-<project>-<model>.md`
2. Any new mistake → `D:\.agents\mistakes\` (git commit)
3. Any new staging pattern → `D:\.agents\staging\` (git commit)
4. Update `D:\.agents\BRAIN.md` index
5. Update `D:\.agents\projects\<project>.md`

**When a provider goes down:**
1. `Ctrl+C` in that provider's terminal
2. Type `/jodl-stop` in Claude chat
3. Claude scans for `claimed-<provider>-*.yaml` → gives exact `--force-reclaim` commands
4. Other daemons pick up the returned tasks automatically

---

*Generated 2026-05-29 · JODL v0.1 · github.com/JodLHarDxD/Ai-cowork*
