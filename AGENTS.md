# Agent Instructions — jodl-workspace
# Loaded by: Codex, OpenAI Agents, any AGENTS.md-compatible tool

## BRAIN — Read First

Scan D:\.agents\BRAIN.md at session start.
Load ONLY entries relevant to current task.

## Memory Read Protocol
1. D:\.agents\BRAIN.md — mistakes + patterns for current task
2. D:\.agents\projects\jodl-workspace.md — project status
3. D:\.agents\handoffs\ — newest handoff file for context

## Memory Write Protocol

Confidence tiers — never skip:
- experiments/ — write BEFORE making bold/risky code change
- staging/     — write during session for new learnings
- mistakes/    — write on confirmed failure (1x sufficient)
- patterns/    — graduate from staging after 2+ sessions validated

After every brain write:
```bash
cd D:\.agents && git add -A && git commit -m "brain: <what changed>"
```

## Frontmatter (required on every brain entry)
```yaml
---
confidence: experimental | staging | proven | deprecated
added-by: codex | openai-agent | <model>
date: YYYY-MM-DD
project: jodl-workspace
sessions-validated: 0
contradicts: []
undo: "<exact reversal steps>"
---
```

## Project: jodl-workspace
Root: D:\jodl-workspace\
Package manager: pnpm
Build: turbo build
Dev: pnpm dev --filter=@jodl/app-sarta

### Packages
- @jodl/tokens     — design tokens (colors, type, spacing, motion)
- @jodl/motion     — GSAP presets, Lenis configs
- @jodl/typography — font pairings, reveal, highlight
- @jodl/ui         — primitive components (stub)
- @jodl/patterns   — promoted components (stub)
- @jodl/hooks      — React hooks (stub)
- @jodl/system     — registry, graph, agents, feedback (intelligence layer)

### Apps
- @jodl/app-sarta        — luxury fashion ecom (React+Vite+TS)
- @jodl/app-creat-studio — placeholder
- @jodl/app-jodlxverse   — placeholder

### CLI
pnpm jodl search "luxury hero"
pnpm jodl compose "product page" --context luxury-fashion
pnpm jodl curate https://linear.app --type motion
pnpm jodl feedback CartDrawer 5 --outcome kept

## Known constraints
- lenis: use ^1.3.0 (v2 does not exist in npm)
- better-sqlite3: deferred — needs C++ build tools on Windows
- TS6 bundler moduleResolution: ignoreDeprecations "6.0" in tsconfig
- SARTA source of truth: apps/sarta/ (NOT D:\SARTA\sarta-store\)

## Session end
Write handoff to D:\.agents\handoffs\<YYYY-MM-DD>-jodl-workspace-<model>.md
Update D:\.agents\projects\jodl-workspace.md with status changes.

---

## JODL CO-WORK PROTOCOL — autonomous mode

When user says "run jodl" (or anything that means "do your queue work"):

1. Read D:\.agents\jodl-runbook.md — universal protocol for all AIs
2. Set JODL_PROVIDER if not set (you are typically `codex`)
3. Follow the per-cycle loop in the runbook:
   - `jodl next --dry-run` → find your task
   - `jodl claim <taskId>` → atomic claim, prints brief + system-prompt + prior context
   - Generate your response according to your role
   - Write response to `D:\.agents\command-bus\active\<sess>\tasks\<taskId>.draft.md`
   - `jodl submit <taskId> --file <path>` → marks done + spawns children
   - Loop until "no tasks for me"
4. Report back: which tasks done, what spawned, anything blocked.

Your typical roles: implementation-orchestrator, ship-orchestrator, frontend-master, backend-master, schema-master, reliability-master.

CLI binary: `node D:\jodl-workspace\tools\jodl-cli\bin\jodl.js <command>`
(or `pnpm jodl <command>` from D:\jodl-workspace)
