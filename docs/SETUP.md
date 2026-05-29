# Setup Guide

Get the JODL bus running on your machine. Estimated time: 15 minutes.

---

## Prerequisites

- Node.js ≥ 20
- pnpm 11 (`npm install -g pnpm@11`)
- At least one API key (Anthropic, OpenAI, or Google)
- A writable directory for the bus (the "brain root")

---

## 1. Clone and install

```bash
git clone https://github.com/JodLHarDxD/Ai-cowork
cd Ai-cowork
pnpm install
pnpm build
```

---

## 2. Create the brain directory

The brain root holds the bus queue, routing matrix, and shared knowledge. Create it anywhere writable.

```bash
# Linux / macOS
mkdir -p ~/.agents/command-bus/{active,done,events}

# Windows (PowerShell)
New-Item -ItemType Directory -Force ~/.agents/command-bus/active
New-Item -ItemType Directory -Force ~/.agents/command-bus/done
New-Item -ItemType Directory -Force ~/.agents/command-bus/events
```

---

## 3. Set environment variables

```bash
# Required
export BUS_ROOT=~/.agents          # path to brain directory
export JODL_PROVIDER=claude-code   # your provider: claude-code | antigravity | codex

# Provider API keys (set only the ones you use)
export ANTHROPIC_API_KEY=sk-ant-...   # for claude-code provider
export GOOGLE_API_KEY=...             # for antigravity (Gemini) provider
export OPENAI_API_KEY=sk-...          # for codex (GPT) provider
```

Add these to your shell profile (`.bashrc`, `.zshrc`, or PowerShell profile) to persist across sessions.

**Windows (PowerShell profile):**
```powershell
$env:BUS_ROOT = "$HOME\.agents"
$env:JODL_PROVIDER = "claude-code"
$env:ANTHROPIC_API_KEY = "sk-ant-..."
```

---

## 4. Create the routing matrix

Create `<BUS_ROOT>/routing-matrix.yaml`:

```yaml
# Maps agent role → provider + model
# Edit this to change which model runs which role

master-orchestrator:
  provider: claude-code
  model: claude-opus-4-7

design-orchestrator:
  provider: claude-code
  model: claude-sonnet-4-6

architecture-orchestrator:
  provider: claude-code
  model: claude-opus-4-7

implementation-orchestrator:
  provider: claude-code
  model: claude-sonnet-4-6

security-orchestrator:
  provider: claude-code
  model: claude-opus-4-7

ship-orchestrator:
  provider: claude-code
  model: claude-sonnet-4-6

# Sub-agents
research-master:   { provider: claude-code, model: claude-sonnet-4-6 }
uiux-master:       { provider: claude-code, model: claude-sonnet-4-6 }
motion-master:     { provider: claude-code, model: claude-sonnet-4-6 }
typography-master: { provider: claude-code, model: claude-sonnet-4-6 }
architect:         { provider: claude-code, model: claude-opus-4-7 }
schema-master:     { provider: claude-code, model: claude-sonnet-4-6 }
style-guide:       { provider: claude-code, model: claude-sonnet-4-6 }
frontend-master:   { provider: claude-code, model: claude-sonnet-4-6 }
backend-master:    { provider: claude-code, model: claude-sonnet-4-6 }
database-master:   { provider: claude-code, model: claude-sonnet-4-6 }
threat-modeler:    { provider: claude-code, model: claude-opus-4-7 }
vuln-scanner:      { provider: claude-code, model: claude-sonnet-4-6 }
pentest-simulator: { provider: claude-code, model: claude-opus-4-7 }
reliability-master:{ provider: claude-code, model: claude-sonnet-4-6 }
legal-master:      { provider: claude-code, model: claude-sonnet-4-6 }
deploy-master:     { provider: claude-code, model: claude-sonnet-4-6 }
```

> For multi-provider setup (Claude + Gemini + GPT), assign different providers per role. See [PROTOCOL.md](PROTOCOL.md) for provider string values.

---

## 5. Create the brain knowledge directory

Optional but recommended. Create these directories:

```bash
mkdir -p ~/.agents/mistakes
mkdir -p ~/.agents/patterns
mkdir -p ~/.agents/staging
mkdir -p ~/.agents/experiments
```

Add markdown files to any directory. They are injected into every agent's context at execution time. Format: plain markdown, one entry per file.

Example `~/.agents/mistakes/no-inline-hex.md`:
```markdown
Never use hex color literals in component code. Always import from the token package.
Reason: hardcoded values drift from the design system on every token update.
```

---

## 6. Update bus.ts with your paths

The reference implementation has two hardcoded paths. Update them to match your setup:

In `tools/jodl-cli/src/bus.ts`:
```typescript
export const BUS_ROOT   = process.env["BUS_ROOT"]   ?? "~/.agents";
export const BRAIN_ROOT = process.env["BRAIN_ROOT"] ?? "~/.agents";
```

> **Note:** the current repo version uses hardcoded Windows paths. A future version will read these from environment variables. For now, edit the constants directly before building.

Rebuild after editing:
```bash
pnpm --filter @jodl/cli build
```

---

## 7. Verify setup

```bash
pnpm jodl whoami
```

Expected output:
```
👤 Provider: claude-code
   Profile:  ✗ not declared — paste PROVIDER_INTRO.md to your AI first
   API keys:
     ✓ Claude (claude-code)
   Active sessions: 0
```

---

## 8. Run your first session

```bash
# Submit a brief — spawns master-orchestrator task
pnpm jodl brief "build a responsive product listing page with filters"

# Check what was created
pnpm jodl status

# Run the task
pnpm jodl daemon
```

The daemon claims tasks, executes them, parses spawn-tasks output, and loops. It polls every 5 seconds when idle.

---

## Multi-provider setup

To run different agents on different providers simultaneously:

**Terminal 1 (Claude):**
```bash
export JODL_PROVIDER=claude-code
export ANTHROPIC_API_KEY=sk-ant-...
pnpm jodl daemon
```

**Terminal 2 (Gemini):**
```bash
export JODL_PROVIDER=antigravity
export GOOGLE_API_KEY=...
pnpm jodl daemon
```

**Terminal 3 (GPT):**
```bash
export JODL_PROVIDER=codex
export OPENAI_API_KEY=sk-...
pnpm jodl daemon
```

Each daemon only claims tasks assigned to its provider via the routing matrix. They work in parallel without coordination.

---

## Manual mode (no API key)

If you want to run an agent manually (paste into Claude.ai, ChatGPT, etc.):

```bash
# Claim a task — prints the full system prompt + context + brief
pnpm jodl claim <taskId>

# Copy the output into your AI of choice, get the response, then:
pnpm jodl submit <taskId> -f output.md
```

The bus parses `spawn-tasks` from the submitted output and queues children automatically.

---

## Watch the queue

```bash
pnpm jodl watch        # live dashboard (auto-refresh)
pnpm jodl status       # static snapshot
```

---

## Troubleshooting

**`JODL_PROVIDER env var not set`**
→ Set `export JODL_PROVIDER=claude-code` in your shell.

**`No pending tasks for claude-code`**
→ Check `pnpm jodl status`. If tasks exist for other providers, they're waiting for the correct provider daemon.

**Task stuck in `claimed` state**
→ Reset it: `pnpm jodl next --force-reclaim <taskId>`

**`@google/genai not installed`**
→ Run: `pnpm add @google/genai --filter @jodl/cli`

**Spawn-tasks not parsing**
→ Agent output must end with a fenced ` ```json ` block containing `"spawn-tasks": [...]`. Check the raw `.out.md` file in the tasks directory.
