# JODL Bus Protocol

Language-agnostic specification. Any language that can rename files and read/write YAML can implement a compatible agent.

---

## Overview

The protocol has three layers:

1. **Task queue** — filesystem directory, atomic rename as lock
2. **Routing matrix** — YAML file mapping role → provider + model
3. **Context injection** — session outputs + shared brain prepended to every agent call

---

## Directory layout

```
<BUS_ROOT>/
  command-bus/
    active/
      <sessionId>/
        session.json
        brief.md
        tasks/
          pending-<taskId>.yaml
          claimed-<provider>-<taskId>.yaml
          done-<taskId>.yaml
          <taskId>.out.md
    done/
      <sessionId>/          ← completed sessions moved here
    events/
      <timestamp>-<TYPE>.json
      <timestamp>-<TYPE>.processed.json
```

`BUS_ROOT` is any writable directory. Default in the reference implementation: `~/.agents` (configurable via env).

---

## Session

Created by `jodl brief`. One session = one project brief.

**session.json schema:**
```json
{
  "id": "sess-<8-hex>",
  "brief": "plain text brief from CEO",
  "phase": "design | build | ship",
  "createdAt": "ISO-8601",
  "createdBy": "claude-code | antigravity | codex | <any string>"
}
```

---

## Task file

**Filename states:**
```
pending-<taskId>.yaml              unclaimed
claimed-<provider>-<taskId>.yaml   in-flight
done-<taskId>.yaml                 complete
```

`taskId` = 8 hex characters (e.g. `a3f9c12b`). Must be unique within a session.

**YAML schema:**
```yaml
id: a3f9c12b
sessionId: sess-00ff1122
role: frontend-master
assignedProvider: codex
assignedModel: gpt-5          # optional — falls back to routing matrix
phase: design                 # design | build | ship
parallelGroup: 3              # optional — informational only
isMerge: true                 # optional — merge pass flag, prevents re-spawn
dependsOn: [a1b2c3d4, e5f6a7b8]   # task ids that must be done first
brief: |
  Build the ProductCard component using the design spec from uiux-master.
  Use @jodl/tokens for all color and spacing values.
```

---

## Claim protocol

```
1. Find pending-<id>.yaml where:
   - assignedProvider matches current provider
   - all ids in dependsOn are in the done set

2. Attempt: rename("pending-<id>.yaml", "claimed-<provider>-<id>.yaml")
   - Success → you own the task
   - ENOENT  → lost race, another agent claimed it first → try next task

3. Execute agent with system prompt + context

4. Write output to <id>.out.md

5. rename("claimed-<provider>-<id>.yaml", "done-<id>.yaml")
```

The rename is atomic within a volume on Windows (NTFS) and POSIX (ext4, APFS, etc.). This is the ONLY lock primitive used. No file locks, no `.lock` files, no advisory locks.

---

## Spawn-tasks contract

Any agent can spawn child tasks by including a JSON block at the end of its output:

````
```json
{
  "spawn-tasks": [
    {
      "role": "uiux-master",
      "brief": "Compose the hero section...",
      "depends-on": [],
      "parallel-group": 1
    },
    {
      "role": "motion-master",
      "brief": "Choreograph entrance animations...",
      "depends-on": ["uiux-master"],
      "parallel-group": 2
    }
  ],
  "phase": "design"
}
```
````

**`depends-on` resolution:** use **role names**, not task IDs. The bus resolves role → ID at spawn time via a pre-pass over the task list.

**Duplicate role constraint:** if you spawn two tasks with the same role, only the last one's ID is stored in the resolution map — the first task's dependency chain silently breaks. Always spawn exactly one task per role per spawn block.

**Merge pass auto-queue:** after a leaf-spawning orchestrator writes its children, the bus auto-queues a merge task with `isMerge: true` that depends on all child IDs. The orchestrator's system prompt receives a brief beginning `## MERGE PHASE`. On this pass it must output markdown only — no `spawn-tasks` block.

**Merge pass guard:** if `isMerge: true` is set on the executing task, any `spawn-tasks` block in the output is silently ignored. This prevents infinite recursion.

---

## Routing matrix

`routing-matrix.yaml` — maps role name → provider + model.

```yaml
# Inline format
master-orchestrator: { provider: claude-code, model: claude-opus-4-7 }

# Block format
design-orchestrator:
  provider: antigravity
  model: gemini-1.5-pro
```

**Supported provider values** (reference implementation):
- `claude-code` — Anthropic Claude API
- `antigravity` — Google Gemini API
- `codex` — OpenAI API

Unknown provider = manual-claim flow: bus prints task brief, waits for `jodl submit`.

**Cache:** the matrix is cached in memory per process. File `mtime` is checked on every read — changes take effect on the next task without restart.

---

## Context injection

Before every agent call, the bus prepends:

```
[AGENTS_BASE universal prompt]        ← base layer, all agents
[agent's system-prompt.md]            ← role-specific
[shared brain: mistakes + patterns]   ← optional, from brain directory
[prior session outputs]               ← domain-scoped (see below)
[runtime alerts from SYNAPSE events]  ← optional
```

**Domain scoping:** leaf agents only receive outputs from their own domain + any orchestrator outputs. This keeps context windows tight while preserving cross-domain awareness.

Domain membership is derived from role name — no extra YAML field needed:

| Roles | Domain |
|-------|--------|
| `*-orchestrator`, `master-orchestrator` | meta (sees all outputs) |
| `research-master`, `uiux-master`, `motion-master`, `typography-master`, `style-guide`, `design-orchestrator` | design |
| `architect`, `schema-master`, `database-master`, `architecture-orchestrator` | architecture |
| `frontend-master`, `backend-master`, `implementation-orchestrator` | implementation |
| `threat-modeler`, `vuln-scanner`, `pentest-simulator`, `security-orchestrator` | security |
| `reliability-master`, `legal-master`, `deploy-master`, `ship-orchestrator` | ship |

---

## SYNAPSE events

Broadcast mechanism for runtime coordination between daemons.

**Event file:** `<BUS_ROOT>/command-bus/events/<timestamp>-<TYPE>.json`

```json
{
  "id": "evt-<8-hex>",
  "type": "API_RATE_LIMIT_WARNING",
  "domain": "design | architecture | implementation | security | ship | meta | all",
  "severity": "info | warning | critical",
  "payload": {},
  "timestamp": "ISO-8601",
  "source": "claude-code"
}
```

**Event types and effects:**

| Type | Effect on receiving daemon |
|------|--------------------------|
| `API_RATE_LIMIT_WARNING` | cap output to 4096 tokens, add 2s delay |
| `PROVIDER_UNAVAILABLE` | skip that provider, return task to pending |
| `SCHEMA_DEPRECATION` | warn agent to re-read schema before writing |
| `TASK_FAILED` | inject failure context for downstream agents |
| `CODEBASE_CHANGED` | warn agent to re-read files before writing |

Events are consumed by renaming `.json` → `.processed.json`. Idempotent — concurrent daemons both try, one gets `ENOENT`, moves on.

**Domain routing:** an event with `domain: "design"` is only applied to tasks in the design domain. `domain: "all"` broadcasts to every daemon. `domain: "meta"` only applies to orchestrators.

---

## Implementing a compatible agent (any language)

Minimum viable implementation:

```python
import os, yaml, json, glob, time

BUS_ROOT   = os.environ["BUS_ROOT"]
PROVIDER   = os.environ["JODL_PROVIDER"]
ACTIVE_DIR = f"{BUS_ROOT}/command-bus/active"

def find_next_task(session_id=None):
    sessions = [session_id] if session_id else os.listdir(ACTIVE_DIR)
    for sid in sessions:
        tasks_dir = f"{ACTIVE_DIR}/{sid}/tasks"
        done = {f.replace("done-","").replace(".yaml","")
                for f in os.listdir(tasks_dir) if f.startswith("done-")}
        for f in os.listdir(tasks_dir):
            if not f.startswith("pending-"): continue
            task = yaml.safe_load(open(f"{tasks_dir}/{f}"))
            if task["assignedProvider"] != PROVIDER: continue
            if not all(d in done for d in task.get("dependsOn", [])): continue
            return sid, f"{tasks_dir}/{f}", task
    return None

def claim_task(path, provider):
    dir_, name = os.path.split(path)
    task_id = name.replace("pending-","").replace(".yaml","")
    new_path = f"{dir_}/claimed-{provider}-{task_id}.yaml"
    try:
        os.rename(path, new_path)   # atomic — first rename wins
        return new_path
    except FileNotFoundError:
        return None                 # lost race

def mark_done(claimed_path, output):
    dir_, name = os.path.split(claimed_path)
    # extract taskId from "claimed-<provider>-<taskId>.yaml"
    task_id = name.split("-")[-1].replace(".yaml","")
    open(f"{dir_}/{task_id}.out.md", "w").write(output)
    os.rename(claimed_path, f"{dir_}/done-{task_id}.yaml")
```

The rest (LLM call, context injection, spawn parsing) is application logic layered on top of this core.

---

## Provider identity

Set via environment variable:

```bash
export JODL_PROVIDER=claude-code     # or: antigravity | codex | <custom>
```

The provider string is embedded in the claimed task filename and in session metadata. It must be consistent across all commands in a session.

---

## Compatibility guarantees

A task file written by any implementation is readable by any other implementation as long as:
1. YAML schema fields match the spec above
2. Filename conventions are followed exactly
3. `rename()` is used for all state transitions (never `copy + delete`)
4. `<taskId>.out.md` is written before the rename to `done-`
