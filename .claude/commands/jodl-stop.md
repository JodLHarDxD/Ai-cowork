Help me detach a provider from the JODL bus cleanly.

The user will specify a provider name (claude-code, antigravity, or codex) or I will ask.

Steps:
1. If provider not specified, ask: "Which provider to detach? (claude-code / antigravity / codex)"
2. Scan D:\.agents\command-bus\active\**\tasks\ for any files matching claimed-<provider>-*.yaml
3. For each stuck claimed task found, give the exact command to force-reclaim it:
   pnpm --filter @jodl/cli jodl next --force-reclaim <taskId>
4. Confirm: "Provider <name> detached. Tasks returned to pending: <list or 'none'>"
5. Remind: daemon process for that provider must be killed separately (Ctrl+C in its terminal)

Note: there is no "unregister" command — stopping the daemon + reclaiming stuck tasks is the full detach.
