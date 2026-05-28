Read the JODL bus state and give me a clear report.

1. Read all session.json files under D:\.agents\command-bus\active\sess-*\
2. For each session, list all task files under tasks\ — count pending / claimed / done per provider
3. Check D:\.agents\command-bus\events\ for any unprocessed .json files (not .processed.json)
4. Report format:
   - Sessions: id, phase, brief (first 60 chars)
   - Per provider: pending count, claimed tasks (id + role), done count
   - Any active SYNAPSE events (type + domain)
   - Any tasks stuck in claimed state (just flag them — no age estimate needed)
5. End with: "Next: <what should happen next based on state>"
