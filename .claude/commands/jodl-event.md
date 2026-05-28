Help me broadcast a SYNAPSE event to the JODL bus.

If the user gave arguments after /jodl-event, parse them as: <TYPE> <domain> [payload]
If no arguments, ask:
  1. Event type? (API_RATE_LIMIT_WARNING / PROVIDER_UNAVAILABLE / SCHEMA_DEPRECATION / TASK_FAILED / CODEBASE_CHANGED)
  2. Target domain? (design / architecture / implementation / security / ship / meta / all)
  3. Any payload? (optional — e.g. provider name for PROVIDER_UNAVAILABLE)

Then give the exact command to run:
```powershell
pnpm --filter @jodl/cli jodl emit <TYPE> <domain> '<json-payload-if-any>'
```

After they confirm, explain in one sentence what daemons will do when they pick up this event.
