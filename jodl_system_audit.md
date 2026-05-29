# JODL System Audit — Full Source Review

**Auditor:** Antigravity (Gemini) · **Date:** 2026-05-29
**Files read:** 18 source files, 11 agent prompts, 4 config files, 3 graph JSONs

---

## Scope

I read every file in:
- [bus.ts](file:///D:/jodl-workspace/tools/jodl-cli/src/bus.ts) — core engine (499 lines)
- [bus-commands.ts](file:///D:/jodl-workspace/tools/jodl-cli/src/commands/bus-commands.ts) — CLI surface (906 lines)
- [agent.ts](file:///D:/jodl-workspace/tools/jodl-cli/src/commands/agent.ts) — `jodl agent run` (181 lines)
- [watch.ts](file:///D:/jodl-workspace/tools/jodl-cli/src/commands/watch.ts) — live dashboard (242 lines)
- [routing-matrix.yaml](file:///D:/.agents/routing-matrix.yaml) — role → provider routing
- [AGENTS_BASE.md](file:///D:/jodl-workspace/packages/jodl-system/agents/AGENTS_BASE.md) — universal base prompt
- All 11 agent `system-prompt.md` files (design-orchestrator, uiux-master, motion-master, typography-master, etc.)
- [pairings.json](file:///D:/jodl-workspace/packages/jodl-system/graph/pairings.json), [feedback.json](file:///D:/jodl-workspace/packages/jodl-system/graph/feedback.json), [lineage.json](file:///D:/jodl-workspace/packages/jodl-system/graph/lineage.json)
- [jodl-runbook.md](file:///D:/.agents/jodl-runbook.md)

---

## Part 1: Real Bugs in Source Code

### 🔴 BUG 1 — `claimTask()` path separator is Windows-hardcoded

[bus.ts:211-224](file:///D:/jodl-workspace/tools/jodl-cli/src/bus.ts#L211-L224)

```typescript
const dir = taskPath.substring(0, taskPath.lastIndexOf("\\"));
const oldName = taskPath.substring(taskPath.lastIndexOf("\\") + 1);
```

Uses `"\\"` (backslash) for path parsing. If Node ever normalizes to `/` (WSL, Git Bash, future cross-platform), this silently produces `dir = ""` and `oldName = full path`, causing `renameSync` to fail with an opaque error.

Same bug in [markTaskDone()](file:///D:/jodl-workspace/tools/jodl-cli/src/bus.ts#L226-L236).

**Fix:** Use `path.dirname()` and `path.basename()` instead. Zero breakage risk.

---

### 🔴 BUG 2 — `parseTaskFilename` regex can't parse multi-hyphen providers

[bus.ts:204](file:///D:/jodl-workspace/tools/jodl-cli/src/bus.ts#L200-L208)

```typescript
const m = filename.match(/^claimed-([^-]+(?:-[^-]+)*?)-([a-f0-9]+)\.yaml$/);
```

The regex `([^-]+(?:-[^-]+)*?)` is **lazy** (`*?`). For filename `claimed-claude-code-abc12345.yaml`:
- It tries to match `claimedBy = "claude"` and `taskId = "code-abc12345"` first (minimal match)
- `code-abc12345` won't match `[a-f0-9]+` so it backtracks
- Eventually finds `claude-code` + `abc12345` — **but only if the task ID is pure hex**

This works today because `genId()` produces hex-only IDs. But if anyone ever adds a prefix with hyphens to task IDs, claim tracking silently breaks.

**Risk:** Low today, high if ID format changes. Same regex appears in [watch.ts:84](file:///D:/jodl-workspace/tools/jodl-cli/src/commands/watch.ts#L84).

---

### 🟡 BUG 3 — `_matrixCache` never invalidates

[bus.ts:31-77](file:///D:/jodl-workspace/tools/jodl-cli/src/bus.ts#L31-L77)

```typescript
let _matrixCache: Map<string, RouteEntry> | null = null;
```

The routing matrix is cached forever per process. If the CEO edits `routing-matrix.yaml` while a daemon is running, the daemon uses stale routes. New tasks get assigned to the wrong provider.

**Fix:** Check `mtime` of the file before returning cache. Minimal cost, prevents silent misrouting.

---

### 🟡 BUG 4 — `events/` directory missing from bus layout

[bus.ts:17](file:///D:/jodl-workspace/tools/jodl-cli/src/bus.ts#L17) defines `EVENTS_DIR = join(BUS_ROOT, "events")` but the actual [command-bus directory](file:///D:/.agents/command-bus) has no `events/` folder:

```
command-bus/
├── README.md
├── active/
├── done/
└── inbox/
```

`broadcastEvent()` calls `ensureDir()` so it won't crash, but `readPendingEvents()` returns `[]` silently. SYNAPSE events appear to work but **no event is ever actually delivered** until the first `emit` creates the directory.

**Impact:** The entire SYNAPSE event layer is effectively dormant. Not broken, but misleading — the dashboard and docs suggest it's actively used.

---

### 🟡 BUG 5 — `agent.ts` ignores routing matrix, hardcodes Anthropic

[agent.ts:76-84](file:///D:/jodl-workspace/tools/jodl-cli/src/commands/agent.ts#L76-L84)

`jodl agent run <name>` **always uses Anthropic Claude**, ignoring the routing matrix entirely:

```typescript
const apiKey = process.env["ANTHROPIC_API_KEY"];
// ...
const client = new Anthropic({ apiKey });
```

If you run `jodl agent run motion-master --brief "..."`, it calls Claude even though routing-matrix says `motion-master → antigravity → gemini-3.5-flash`. This is a completely separate code path from the bus daemon.

**Impact:** `jodl agent run` is a legacy Claude-only pathway. The bus daemon (`jodl next`/`jodl daemon`) correctly dispatches to Gemini/OpenAI. Two different execution paths exist — one respects routing, one doesn't.

---

### 🟡 BUG 6 — `feedback.json` schema mismatch

The bus writes feedback as:
```typescript
// bus-commands.ts:65-68
store.scores[role] = { uses: 0, done: 0, failed: 0 };
```

But [feedback.json](file:///D:/jodl-workspace/packages/jodl-system/graph/feedback.json) documents the schema as:
```json
"notes": "Score structure: { componentId: { uses: N, ratings: [1-5], avg: N, kept: N, edited: N, rejected: N } }"
```

Two different schemas: one is **per-role task outcomes** (what the code writes), the other is **per-component quality ratings** (what the JSON says it is). The CLI's `jodl feedback` command writes the component-rating format, but the bus daemon writes the role-outcome format.

**Impact:** The two feedback paths write incompatible structures to the same file. First `jodl feedback` call after a daemon run would corrupt the data.

> [!WARNING]
> This is a data-corruption bug. If both `jodl feedback <component> <rating>` and the daemon's `recordFeedback(role, "done")` write to the same file, one will overwrite the other's schema.

---

## Part 2: Antigravity's (My) Role — Safety Analysis

### What I Own in Routing Matrix

| Role | Model | Phase |
|------|-------|-------|
| design-orchestrator | gemini-1.5-pro | design |
| research-master | gemini-1.5-flash | design |
| uiux-master | gemini-1.5-pro | design |
| motion-master | gemini-3.5-flash | design |
| typography-master | gemini-3.5-flash | design |
| style-guide | gemini-3.5-flash | architecture |
| legal-master | gemini-3.5-flash | ship |

**7 of 18 roles** are mine. All are **spec-output roles** (produce YAML/markdown specs, not code). Only `design-orchestrator` spawns children.

### Can I Break the System?

| If I change... | Breaks? | Why |
|---|---|---|
| My `system-prompt.md` content | ❌ No | Prompts are read at runtime from files. No compile step. Daemon picks up changes on next task. |
| My spawn-tasks JSON format | ⚠️ **Yes if malformed** | [spawnFromParsed()](file:///D:/jodl-workspace/tools/jodl-cli/src/commands/bus-commands.ts#L283-L328) requires `role` + `brief` fields. Missing either → task silently skipped with error log. |
| My output YAML spec format | ❌ No | Leaf output is `.out.md` — free-form markdown. No parser validates it. |
| `routing-matrix.yaml` (add new role) | ⚠️ Partial | Bus falls back to `claude-code` for unknown roles. New roles work but route wrong without matrix entry. |
| `@jodl/tokens` values | 🔴 **Yes** | Every agent's code references these tokens. Changing token values without CODEBASE_CHANGED event = UI drift. |
| `pairings.json` / `lineage.json` | ❌ No | Read-only context. `jodl compose` uses them, agents reference them, but nothing validates against them at build time. |

### My Critical Constraint

My `design-orchestrator` prompt specifies deps as `"<research-master task id>"` placeholders. But [spawnFromParsed()](file:///D:/jodl-workspace/tools/jodl-cli/src/commands/bus-commands.ts#L293-L311) resolves deps by **role name** via `idMap`:

```typescript
const idMap = new Map<string, string>();
for (const t of tasks) {
  if (t.role && t.brief) idMap.set(t.role, genId(""));
}
// ...
const deps = (t["depends-on"] ?? []).map((d) => idMap.get(d) ?? d);
```

So `"depends-on": ["research-master"]` resolves correctly. But if I spawn **two tasks with the same role** (e.g., two `research-master` tasks), `idMap` only keeps the **last one** — first task's ID is lost and the dependency chain breaks silently.

> [!IMPORTANT]
> **Rule for my orchestrator output:** Never spawn duplicate roles in the same spawn-tasks block. The dep-resolution idMap overwrites.

---

## Part 3: Structural Gaps (Non-Breaking but Worth Fixing)

### Gap 1 — No File-Level Coordination

The bus locks **tasks** but not **files**. If `frontend-master` and `motion-master` are in `parallel-group: 3` and both write to `ProductCard.tsx`, last write wins. The task YAML has no `targetFiles` field.

**Risk:** Currently low because design agents output specs (not code), and implementation is sequential. But if the system ever parallelizes implementation tasks, this becomes a data-loss vector.

### Gap 2 — Design-Orchestrator Has No Merge Phase ✅ FIXED (2026-05-29)

Previously: the bus had no mechanism to re-invoke an orchestrator after its children completed, so the design-package merge described in the prompt never ran.

**Fix:** Self-spawned dependent merge task — no new bus protocol. When a leaf-spawning orchestrator emits its `spawn-tasks`, `maybeSpawnMergeTask()` ([bus-commands.ts](file:///D:/jodl-workspace/tools/jodl-cli/src/commands/bus-commands.ts)) auto-queues one extra task with the **same role**, `isMerge: true`, and `dependsOn = [all child ids]`. The existing `findNextTask` dependency gate re-runs the orchestrator's prompt once every sub-agent is `done`; on that second pass it gets the children's outputs in context and produces the final package.

Guards: merge output is markdown-only, and `spawnFromParsed` treats a merge pass as terminal (ignores any `spawn-tasks` it emits) — so it never recurses. **Scope:** only fires when all children are non-orchestrator roles, so the master-orchestrator (which spawns domain orchestrators whose spawn-tasks complete instantly) is deliberately excluded to avoid a premature merge. Master re-invoke remains a separate, deeper gap. Validated by isolated smoke test (gating + `isMerge` YAML round-trip).

### Gap 3 — `jodl agent run` Is Orphaned

[agent.ts](file:///D:/jodl-workspace/tools/jodl-cli/src/commands/agent.ts) is a completely separate execution path from the bus. It:
- Always uses Anthropic (ignores routing)
- Doesn't write to command-bus (no task files)
- Doesn't record in feedback.json (different code path)
- Doesn't inject brain context (only injects registry)

It's useful for ad-hoc testing but confusing alongside the bus system. Should either be deprecated or aligned.

### Gap 4 — No `research-master` or `style-guide` System Prompts

These roles are in the routing matrix assigned to me but have **no `system-prompt.md`** in the agents directory:
- `research-master` — falls back to generic "You are the research-master agent..."
- `style-guide` — falls back to generic
- `database-master`, `threat-modeler`, `vuln-scanner`, `pentest-simulator`, `reliability-master`, `legal-master`, `deploy-master` — all missing

Only 6 of 18 roles have real system prompts. The rest get a one-liner.

---

## Part 4: Recommendations (Prioritized)

| # | Fix | Severity | Status |
|---|-----|----------|--------|
| 1 | Use `path.dirname()`/`path.basename()` in `claimTask`/`markTaskDone` | 🔴 Bug | ✅ DONE (prev session) |
| 2 | Split feedback.json → `feedback-roles.json` + `feedback-components.json` | 🔴 Data corruption | ✅ DONE (prev session) |
| 3 | Add `mtime` check to `_matrixCache` | 🟡 Stale routing | ✅ DONE (prev session) |
| 4 | Create `events/` directory at bus init | 🟡 Dormant feature | ✅ DONE (prev session) |
| 5 | Write system prompts for the 12 missing roles | 🟡 Quality | ✅ DONE (prev session) |
| 6 | Align `jodl agent run` with bus routing | 🟡 Confusion | ✅ DONE (prev session, `routeFor()` already used) |
| 7 | Add orchestrator re-invoke mechanism (merge phase) | 🟢 Feature | ✅ DONE (2026-05-29, self-spawned merge task) |
| 8 | Document duplicate-role dep-resolution limitation | 🟢 Documentation | ✅ DONE (design-orchestrator "Critical constraints") |

---

## Part 5: What I Can Safely Do Right Now

As `antigravity`, I can safely:
- ✅ Write/improve system prompts for my 7 roles (no compile, no bus change)
- ✅ Add entries to `pairings.json`, `lineage.json` (read-only context, no validation)
- ✅ Fix path separator bug in `bus.ts` (pure improvement, zero behavioral change)
- ✅ Add `mtime` cache invalidation to routing matrix loader
- ✅ Create `events/` directory bootstrapping

I should **not** touch:
- ❌ `feedback.json` schema without coordinating with `jodl feedback` command
- ❌ Spawn-tasks JSON contract (other orchestrators depend on it)
- ❌ `jodl agent run` — different code path, needs design discussion first
