/**
 * Command bus — shared filesystem queue for multi-platform AI co-work.
 *
 * Atomic file rename = lock (Windows + POSIX both atomic within a volume).
 * No DB, no daemon required, no network.
 */

import { readFileSync, writeFileSync, readdirSync, renameSync, existsSync, mkdirSync, statSync } from "fs";
import { join, dirname, basename } from "path";
import { randomBytes } from "crypto";

export const BUS_ROOT   = "D:\\.agents\\command-bus";
export const BRAIN_ROOT = "D:\\.agents";
export const INBOX      = join(BUS_ROOT, "inbox");
export const ACTIVE     = join(BUS_ROOT, "active");
export const DONE       = join(BUS_ROOT, "done");
export const EVENTS_DIR = join(BUS_ROOT, "events");

// Bootstrap events directory so SYNAPSE layer is always available
ensureDirSync(EVENTS_DIR);

function ensureDirSync(p: string): void {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

export type Provider = "claude-code" | "antigravity" | "codex" | string;
export type TaskStatus = "pending" | "claimed" | "done";

// ─── routing matrix ─────────────────────────────────────────────────────────

const ROUTING_MATRIX = "D:\\.agents\\routing-matrix.yaml";

export interface RouteEntry {
  provider: Provider;
  model: string;
}

let _matrixCache: Map<string, RouteEntry> | null = null;
let _matrixMtimeMs: number = 0;

export function loadRoutingMatrix(): Map<string, RouteEntry> {
  // Invalidate cache if file has been modified (CEO edits take effect without restart)
  if (_matrixCache && existsSync(ROUTING_MATRIX)) {
    const currentMtime = statSync(ROUTING_MATRIX).mtimeMs;
    if (currentMtime !== _matrixMtimeMs) {
      _matrixCache = null;
    }
  }
  if (_matrixCache) return _matrixCache;

  const map = new Map<string, RouteEntry>();
  if (!existsSync(ROUTING_MATRIX)) {
    _matrixCache = map;
    return map;
  }

  _matrixMtimeMs = statSync(ROUTING_MATRIX).mtimeMs;
  const text = readFileSync(ROUTING_MATRIX, "utf-8");
  const lines = text.split("\n");

  // Parse two formats:
  //   <role>: { provider: X, model: Y }    (inline)
  //   <role>:                                (multi-line block)
  //     provider: X
  //     model: Y

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Inline format: role-name: { provider: X, model: Y }
    const inlineMatch = line.match(/^([a-z-]+):\s*\{\s*provider:\s*([a-z-]+)\s*,\s*model:\s*([a-z0-9.-]+)\s*\}/);
    if (inlineMatch) {
      map.set(inlineMatch[1]!, { provider: inlineMatch[2]!, model: inlineMatch[3]! });
      continue;
    }

    // Multi-line: role-name: followed by indented provider/model
    const blockMatch = line.match(/^([a-z-]+):\s*$/);
    if (blockMatch && i + 2 < lines.length) {
      const next1 = lines[i + 1];
      const next2 = lines[i + 2];
      const providerMatch = next1?.match(/^\s+provider:\s*([a-z-]+)/);
      const modelMatch = next2?.match(/^\s+model:\s*([a-z0-9.-]+)/);
      if (providerMatch && modelMatch) {
        map.set(blockMatch[1]!, { provider: providerMatch[1]!, model: modelMatch[1]! });
      }
    }
  }

  _matrixCache = map;
  return map;
}

/** Look up provider+model for an agent role. Returns null if not in matrix. */
export function routeFor(role: string): RouteEntry | null {
  return loadRoutingMatrix().get(role) ?? null;
}

export type TaskDomain = "design" | "architecture" | "implementation" | "security" | "ship" | "meta";

/** Derive domain from role name — no extra YAML field needed. */
export function domainForRole(role: string): TaskDomain {
  const DESIGN = ["research-master", "uiux-master", "motion-master", "typography-master", "style-guide", "design-orchestrator"];
  const ARCH   = ["architect", "schema-master", "database-master", "architecture-orchestrator"];
  const IMPL   = ["frontend-master", "backend-master", "implementation-orchestrator"];
  const SEC    = ["threat-modeler", "vuln-scanner", "pentest-simulator", "security-orchestrator"];
  const SHIP   = ["reliability-master", "legal-master", "deploy-master", "ship-orchestrator"];
  if (DESIGN.includes(role)) return "design";
  if (ARCH.includes(role))   return "architecture";
  if (IMPL.includes(role))   return "implementation";
  if (SEC.includes(role))    return "security";
  if (SHIP.includes(role))   return "ship";
  return "meta"; // master-orchestrator + unknown
}

export interface TaskFile {
  id: string;
  sessionId: string;
  role: string;
  assignedProvider: Provider;
  assignedModel?: string;
  brief: string;
  dependsOn: string[];        // task ids that must finish first
  phase: "design" | "build" | "ship";
  parallelGroup?: number;
}

export interface Session {
  id: string;
  brief: string;
  phase: "design" | "build" | "ship";
  createdAt: string;
  createdBy: Provider;
}

// ─── helpers ────────────────────────────────────────────────────────────────

export function getProvider(): Provider {
  const p = process.env["JODL_PROVIDER"];
  if (!p) throw new Error("JODL_PROVIDER env var not set. See D:\\.agents\\command-bus\\README.md");
  return p;
}

export function genId(prefix = ""): string {
  return prefix + randomBytes(4).toString("hex");
}

function ensureDir(p: string): void {
  ensureDirSync(p);
}

// ─── sessions ───────────────────────────────────────────────────────────────

export function createSession(brief: string, provider: Provider): Session {
  const id = genId("sess-");
  const session: Session = {
    id,
    brief,
    phase: "design",
    createdAt: new Date().toISOString(),
    createdBy: provider,
  };
  const dir = join(ACTIVE, id);
  ensureDir(dir);
  ensureDir(join(dir, "tasks"));
  writeFileSync(join(dir, "brief.md"), brief);
  writeFileSync(join(dir, "session.json"), JSON.stringify(session, null, 2));
  return session;
}

export function listActiveSessions(): Session[] {
  if (!existsSync(ACTIVE)) return [];
  return readdirSync(ACTIVE)
    .filter((n) => n.startsWith("sess-"))
    .map((id) => {
      const sessionPath = join(ACTIVE, id, "session.json");
      if (!existsSync(sessionPath)) return null;
      return JSON.parse(readFileSync(sessionPath, "utf-8")) as Session;
    })
    .filter((s): s is Session => s !== null);
}

export function loadSession(sessionId: string): Session | null {
  const path = join(ACTIVE, sessionId, "session.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

// ─── tasks ──────────────────────────────────────────────────────────────────

export function writeTask(sessionId: string, task: TaskFile): void {
  const dir = join(ACTIVE, sessionId, "tasks");
  ensureDir(dir);
  const path = join(dir, `pending-${task.id}.yaml`);
  writeFileSync(path, taskToYaml(task));
}

export function listTasks(sessionId: string, status?: TaskStatus): { task: TaskFile; status: TaskStatus; claimedBy?: Provider; path: string }[] {
  const dir = join(ACTIVE, sessionId, "tasks");
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => {
      const path = join(dir, f);
      const parsed = parseTaskFilename(f);
      if (!parsed) return null;
      const task = yamlToTask(readFileSync(path, "utf-8"));
      return { task, status: parsed.status, claimedBy: parsed.claimedBy, path };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .filter((t) => !status || t.status === status);
}

function parseTaskFilename(filename: string): { status: TaskStatus; claimedBy?: Provider } | null {
  if (filename.startsWith("pending-")) return { status: "pending" };
  if (filename.startsWith("done-")) return { status: "done" };
  if (filename.startsWith("claimed-")) {
    const m = filename.match(/^claimed-([^-]+(?:-[^-]+)*?)-([a-f0-9]+)\.yaml$/);
    return { status: "claimed", claimedBy: m?.[1] };
  }
  return null;
}

/** Atomic claim — rename pending-X to claimed-<provider>-X. Returns null if lost race. */
export function claimTask(taskPath: string, provider: Provider): string | null {
  const dir = dirname(taskPath);
  const oldName = basename(taskPath);
  if (!oldName.startsWith("pending-")) return null;
  const taskId = oldName.replace("pending-", "").replace(".yaml", "");
  const newName = `claimed-${provider}-${taskId}.yaml`;
  const newPath = join(dir, newName);
  try {
    renameSync(taskPath, newPath);
    return newPath;
  } catch {
    return null; // lost race — another provider grabbed it
  }
}

export function markTaskDone(claimedPath: string, output: string): void {
  const dir = dirname(claimedPath);
  const oldName = basename(claimedPath);
  const m = oldName.match(/^claimed-[^-]+(?:-[^-]+)*?-([a-f0-9]+)\.yaml$/);
  if (!m) throw new Error(`Invalid claimed task filename: ${oldName}`);
  const taskId = m[1];
  const donePath = join(dir, `done-${taskId}.yaml`);
  const outPath = join(dir, `${taskId}.out.md`);
  writeFileSync(outPath, output);
  renameSync(claimedPath, donePath);
}

/** Find first pending task assigned to this provider with all deps satisfied. */
export function findNextTask(provider: Provider, sessionId?: string): { task: TaskFile; path: string; sessionId: string } | null {
  const sessions = sessionId ? [sessionId] : listActiveSessions().map((s) => s.id);

  for (const sid of sessions) {
    const tasks = listTasks(sid);
    const done = new Set(tasks.filter((t) => t.status === "done").map((t) => t.task.id));

    for (const t of tasks) {
      if (t.status !== "pending") continue;
      if (t.task.assignedProvider !== provider) continue;
      if (!t.task.dependsOn.every((dep) => done.has(dep))) continue;
      return { task: t.task, path: t.path, sessionId: sid };
    }
  }
  return null;
}

/** Find any task by ID across all active sessions. */
export function findTaskById(taskId: string): { task: TaskFile; path: string; sessionId: string; status: TaskStatus } | null {
  const sessions = listActiveSessions();
  for (const s of sessions) {
    const tasks = listTasks(s.id);
    for (const t of tasks) {
      if (t.task.id === taskId) {
        return { task: t.task, path: t.path, sessionId: s.id, status: t.status };
      }
    }
  }
  return null;
}

/** Find claimed task path for a provider+taskId. */
export function findClaimedPath(taskId: string, provider: Provider): string | null {
  const sessions = listActiveSessions();
  for (const s of sessions) {
    const dir = join(ACTIVE, s.id, "tasks");
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir);
    for (const f of files) {
      if (f.startsWith(`claimed-${provider}-${taskId}`) || f.startsWith(`claimed-`) && f.includes(taskId)) {
        return join(dir, f);
      }
    }
  }
  return null;
}

/**
 * Read done task outputs in a session — context injected into next agent.
 *
 * `domain` scoping keeps context windows tight:
 *   - undefined / "meta" → all done outputs (used by orchestrators)
 *   - specific domain    → own-domain outputs + all orchestrator outputs
 *
 * This preserves cross-domain awareness for leaf agents (they see the
 * orchestrator's plan) without drowning them in sibling-domain details.
 */
export function loadSessionContext(sessionId: string, domain?: TaskDomain): string {
  const tasks = listTasks(sessionId, "done");
  const dir = join(ACTIVE, sessionId, "tasks");
  const parts: string[] = [];

  for (const t of tasks) {
    const taskDomain = domainForRole(t.task.role);
    const isOrchestrator = t.task.role.endsWith("-orchestrator");
    // Include if: no filter, meta domain, same domain, or any orchestrator output
    if (domain && domain !== "meta" && taskDomain !== domain && !isOrchestrator) continue;

    const outPath = join(dir, `${t.task.id}.out.md`);
    if (!existsSync(outPath)) continue;
    parts.push(`## ${t.task.role} (task ${t.task.id})\n\nBrief: ${t.task.brief}\n\n---\n\n${readFileSync(outPath, "utf-8")}`);
  }

  return parts.join("\n\n---\n\n");
}

// ─── brain context ───────────────────────────────────────────────────────────

/**
 * Load accumulated team knowledge (mistakes + patterns + staging) for injection
 * into every agent's system prompt.
 *
 * This is the fix for the "Lenis / overflow-x: hidden" class of bug: agents
 * running via API never saw D:\.agents\ — they only got task outputs. Now they
 * get the full mistake checklist and proven patterns before they write a line.
 */
export function loadBrainContext(): string {
  const sections: string[] = [];

  const loadDir = (dir: string, label: string): void => {
    if (!existsSync(dir)) return;
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .sort();
    const entries = files
      .map((f) => readFileSync(join(dir, f), "utf-8").trim())
      .filter(Boolean);
    if (entries.length === 0) return;
    sections.push(`### ${label}\n\n${entries.join("\n\n---\n\n")}`);
  };

  loadDir(join(BRAIN_ROOT, "mistakes"), "Confirmed Mistakes — never repeat these");
  loadDir(join(BRAIN_ROOT, "patterns"), "Proven Patterns — reuse directly");
  loadDir(join(BRAIN_ROOT, "staging"), "Staging — likely true, 1 session validated");

  if (sections.length === 0) return "";
  return `## Shared Brain — Team Knowledge\n\n${sections.join("\n\n---\n\n")}`;
}

// ─── synapse events ──────────────────────────────────────────────────────────

export type SynapseEventType =
  | "API_RATE_LIMIT_WARNING"
  | "PROVIDER_UNAVAILABLE"
  | "SCHEMA_DEPRECATION"
  | "TASK_FAILED"
  | "CODEBASE_CHANGED";

export interface SynapseEvent {
  id: string;
  type: SynapseEventType;
  domain: TaskDomain | "all";
  severity: "info" | "warning" | "critical";
  payload: Record<string, unknown>;
  timestamp: string;
  source: Provider;
}

export interface RuntimeOverrides {
  maxTokens?: number;
  delayMs?: number;
  skipProviders?: Provider[];
  notes?: string[];
}

/** Write an event file to the events directory. Returns the persisted event. */
export function broadcastEvent(event: Omit<SynapseEvent, "id" | "timestamp">): SynapseEvent {
  ensureDir(EVENTS_DIR);
  const full: SynapseEvent = {
    ...event,
    id: genId("evt-"),
    timestamp: new Date().toISOString(),
  };
  writeFileSync(join(EVENTS_DIR, `${Date.now()}-${event.type}.json`), JSON.stringify(full, null, 2));
  return full;
}

/** Read all unprocessed event files. */
export function readPendingEvents(): { event: SynapseEvent; path: string }[] {
  if (!existsSync(EVENTS_DIR)) return [];
  return readdirSync(EVENTS_DIR)
    .filter((f) => f.endsWith(".json") && !f.includes(".processed"))
    .sort()
    .map((f) => {
      const path = join(EVENTS_DIR, f);
      try {
        return { event: JSON.parse(readFileSync(path, "utf-8")) as SynapseEvent, path };
      } catch {
        return null;
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
}

/**
 * Choke point: return true if this event is relevant to the given domain.
 * Domain "meta" (orchestrators) sees everything. "all" events broadcast everywhere.
 */
export function evaluateEventForDomain(event: SynapseEvent, domain: TaskDomain): boolean {
  if (event.domain === "all") return true;
  if (domain === "meta") return true;
  return event.domain === domain;
}

/** Mark event as consumed — rename .json → .processed.json (idempotent). */
export function consumeEvent(path: string): void {
  const processed = path.replace(/\.json$/, ".processed.json");
  try {
    renameSync(path, processed);
  } catch {
    // already consumed by concurrent daemon instance
  }
}

/** Derive runtime overrides from a set of relevant events. */
export function buildRuntimeOverrides(events: SynapseEvent[]): RuntimeOverrides {
  const overrides: RuntimeOverrides = {};
  const notes: string[] = [];

  for (const event of events) {
    switch (event.type) {
      case "API_RATE_LIMIT_WARNING":
        overrides.maxTokens = Math.min(overrides.maxTokens ?? 8192, 4096);
        overrides.delayMs   = Math.max(overrides.delayMs ?? 0, 2000);
        notes.push(`⚠ API rate limit active — output target ≤4096 tokens, be concise`);
        break;
      case "PROVIDER_UNAVAILABLE":
        if (typeof event.payload["provider"] === "string") {
          overrides.skipProviders = [
            ...(overrides.skipProviders ?? []),
            event.payload["provider"] as Provider,
          ];
          notes.push(`⚠ Provider ${event.payload["provider"]} is unavailable`);
        }
        break;
      case "SCHEMA_DEPRECATION":
        notes.push(`⚠ Schema deprecation: ${event.payload["detail"] ?? "verify schema before writing migrations"}`);
        break;
      case "TASK_FAILED":
        notes.push(`⚠ Related task ${event.payload["taskId"]} failed — reason: ${event.payload["reason"] ?? "unknown"}`);
        break;
      case "CODEBASE_CHANGED":
        notes.push(`⚠ Codebase changed in domain "${event.payload["domain"]}" — re-read relevant files before writing`);
        break;
    }
  }

  if (notes.length > 0) overrides.notes = notes;
  return overrides;
}

// ─── yaml (minimal — no deps) ───────────────────────────────────────────────

function taskToYaml(t: TaskFile): string {
  return `id: ${t.id}
sessionId: ${t.sessionId}
role: ${t.role}
assignedProvider: ${t.assignedProvider}
${t.assignedModel ? `assignedModel: ${t.assignedModel}\n` : ""}phase: ${t.phase}
${t.parallelGroup !== undefined ? `parallelGroup: ${t.parallelGroup}\n` : ""}dependsOn: [${t.dependsOn.join(", ")}]
brief: |
${t.brief.split("\n").map((l) => "  " + l).join("\n")}
`;
}

function yamlToTask(s: string): TaskFile {
  const lines = s.split("\n");
  const get = (key: string) => {
    const line = lines.find((l) => l.startsWith(`${key}: `));
    return line ? line.substring(key.length + 2).trim() : "";
  };
  const briefStart = lines.findIndex((l) => l.startsWith("brief: |"));
  const brief = briefStart >= 0
    ? lines.slice(briefStart + 1).map((l) => l.replace(/^  /, "")).join("\n").trimEnd()
    : "";
  const dependsOnRaw = get("dependsOn");
  const dependsOn = dependsOnRaw.replace(/[\[\]]/g, "").split(",").map((s) => s.trim()).filter(Boolean);

  return {
    id: get("id"),
    sessionId: get("sessionId"),
    role: get("role"),
    assignedProvider: get("assignedProvider"),
    assignedModel: get("assignedModel") || undefined,
    phase: (get("phase") || "design") as TaskFile["phase"],
    parallelGroup: get("parallelGroup") ? parseInt(get("parallelGroup")) : undefined,
    dependsOn,
    brief,
  };
}
