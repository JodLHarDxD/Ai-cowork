Show me the exact commands to start a JODL session and run tasks.

Print the following as a step-by-step guide (use the actual commands, not placeholders):

---

## JODL — Start a Session

### 1. Set your provider (run in each terminal that will execute tasks)
```powershell
# Terminal for Claude (claude-code)
$env:JODL_PROVIDER = "claude-code"
$env:ANTHROPIC_API_KEY = "sk-ant-..."   # if not already set

# Terminal for Gemini (antigravity)
$env:JODL_PROVIDER = "antigravity"
$env:GOOGLE_API_KEY = "..."             # if not already set

# Terminal for Codex (codex)
$env:JODL_PROVIDER = "codex"
$env:OPENAI_API_KEY = "sk-..."          # if not already set
```

### 2. Submit a brief (from any terminal with JODL_PROVIDER set)
```powershell
pnpm --filter @jodl/cli jodl brief "your project description here"
```
This spawns a master-orchestrator task. Note the session ID printed.

### 3. Run tasks — two modes

**Auto (daemon — runs until idle or max-tasks)**
```powershell
pnpm --filter @jodl/cli jodl daemon
# or limit to N tasks:
pnpm --filter @jodl/cli jodl daemon --max-tasks 5
```

**Manual (no API key — copy-paste workflow)**
```powershell
# See what's next for you
pnpm --filter @jodl/cli jodl next --dry-run

# Claim it (prints brief + system prompt to paste into your AI)
pnpm --filter @jodl/cli jodl claim <taskId>

# After AI responds, submit output
pnpm --filter @jodl/cli jodl submit <taskId>
# (paste output, then Ctrl+Z + Enter on Windows to finish)
```

### 4. Check status anytime
```powershell
pnpm --filter @jodl/cli jodl status
```

### 5. Signal runtime events (SYNAPSE)
```powershell
# Provider unavailable
pnpm --filter @jodl/cli jodl emit PROVIDER_UNAVAILABLE all '{"provider":"codex"}'

# Rate limit warning
pnpm --filter @jodl/cli jodl emit API_RATE_LIMIT_WARNING all
```

### 6. Detach a provider when done
Use /jodl-stop in chat — I will find any stuck tasks and give reclaim commands.

---

After printing this, check if there is an active session right now (read D:\.agents\command-bus\active\) and if so, add: "Active session found: <id> — run jodl status to see queue."
