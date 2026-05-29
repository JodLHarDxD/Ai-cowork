# Changelog

---

## Current — multi-provider orchestration with merge phase

### Bus engine

**Atomic claim with cross-platform path handling**
- `claimTask()` and `markTaskDone()` now use `path.dirname()` / `path.basename()` instead of hardcoded `"\\"` separators
- Fixes silent failure on WSL, Git Bash, or any path normalized to forward slashes

**Routing matrix with hot-reload**
- `routing-matrix.yaml` parsed at runtime, not compiled in
- `mtime` checked on every read — CEO edits take effect on next task without daemon restart
- Falls back to `claude-code` for any role missing from the matrix

**Feedback split**
- `feedback.json` split into `feedback-roles.json` (daemon writes: per-role `{uses, done, failed}`) and `feedback-components.json` (CLI writes: per-component ratings)
- Eliminates data corruption from two incompatible schemas writing to the same file

**SYNAPSE event layer**
- Filesystem pub/sub: events written to `<BUS_ROOT>/command-bus/events/`
- Types: `API_RATE_LIMIT_WARNING`, `PROVIDER_UNAVAILABLE`, `SCHEMA_DEPRECATION`, `TASK_FAILED`, `CODEBASE_CHANGED`
- Daemons apply runtime overrides (token cap, delay, provider skip) then consume events atomically
- Domain routing: events target specific domains or broadcast to all

**Events directory bootstrap**
- `events/` created at bus init — SYNAPSE layer always available from first run

**Orchestrator two-pass merge**
- Domain orchestrators now run twice automatically
- First pass: emit `spawn-tasks`, bus queues sub-agents
- Second pass: `isMerge: true` task auto-queued, depends on all child IDs, fires once every sub-agent is `done`
- Merge pass is terminal: any `spawn-tasks` in merge output is silently ignored (prevents infinite loops)
- `isMerge` flag round-trips through YAML serialization

### CLI commands

**`jodl daemon`** — auto-claim loop
- Polls every N seconds when idle, immediately re-loops when spawn-tasks found
- `--max-tasks N` to limit, `--interval N` for poll rate, `--session-id` to scope

**`jodl next --force-reclaim <taskId>`** — recovery
- Renames `claimed-*-<id>.yaml` back to `pending-<id>.yaml`
- Unblocks tasks stuck in claimed state from crashed agents

**`jodl emit <TYPE> <domain> [payload]`** — SYNAPSE broadcast
- Publishes event from CLI
- Payload: optional JSON string

**`jodl watch`** — live dashboard
- Auto-refreshing queue view across all active sessions

### Multi-provider execution

**Three provider runners in one daemon:**
- `claude-code` → Anthropic streaming API
- `antigravity` → Google Gemini streaming API (`@google/genai`)
- `codex` → OpenAI streaming API

**`jodl agent run`** routing fix
- Previously hardcoded to Anthropic regardless of routing matrix
- Now reads `routeFor(agentName)` and dispatches to correct provider

### Context system

**Domain-scoped session context**
- Orchestrators (domain = `meta`) receive all prior outputs
- Leaf agents receive: own-domain outputs + all orchestrator outputs
- Prevents context window overflow from cross-domain sibling outputs

**Shared brain injection**
- `loadBrainContext()` reads `<BRAIN_ROOT>/mistakes/`, `patterns/`, `staging/`
- Injected into every agent execution before the system prompt
- Agents running via API now see team knowledge — not just local Claude Code sessions

**`AGENTS_BASE.md` universal base layer**
- Layer-0 prompt prepended to every agent system prompt
- Contains: bus protocol, spawn contract, output format rules, role boundaries

### Agent system

**22 fully-written system prompts** (was 6)

New prompts written for all previously-generic roles:
- `research-master` — brand reference extraction, `@jodl/*` package mapping
- `style-guide` — design system compliance audit (tokens, motion, typography)
- `database-master` — schema design + migration safety
- `threat-modeler` — STRIDE analysis with trust boundary enumeration
- `vuln-scanner` — OWASP Top 10 + dependency CVE scanning
- `pentest-simulator` — adversarial exploit chain discovery
- `reliability-master` — retry patterns, observability, SLOs
- `legal-master` — compliance review, license audit
- `deploy-master` — deployment safety, rollback procedures
- `architect` — hardened with Impeccable + Karpathy principles
- `schema-master` — hardened with migration safety rules
- `frontend-master` — hardened with 11 confirmed React anti-patterns

**Karpathy strict mode** (Codex/implementation agents)
- Four rules injected: think-before-coding, simplicity-first, surgical changes, goal-driven execution
- Counteracts common LLM implementation pitfalls: over-abstraction, speculative error handling, scope creep

**Impeccable design principles** (Antigravity/design agents)
- Anti-patterns: no default Inter, no purple-to-blue gradients, no nested card-in-card
- Verbs: `distill`, `bolder`, `quieter`, `polish`, `delight`
- 7-domain balance: typography, color, spatial, motion, interaction, responsive, UX writing

**Duplicate-role constraint documented**
- `idMap` in spawn resolution overwrites on duplicate role → only last task's ID survives
- Documented in `design-orchestrator` system prompt: never spawn two tasks with the same role

---

## v1 baseline

- Basic task queue: `pending-` / `claimed-` / `done-` lifecycle
- Single provider (Claude only)
- No context injection beyond task brief
- No SYNAPSE events
- 6 agent system prompts (design-orchestrator, uiux-master, motion-master, typography-master, architecture-orchestrator, master-orchestrator)
- No daemon — manual `jodl next` only
- No brain injection
- Hardcoded Windows path separators
- Single feedback.json (collision-prone)
- No merge phase — orchestrators marked done after spawn, never re-invoked
