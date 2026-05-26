/**
 * Command bus — shared filesystem queue for multi-platform AI co-work.
 *
 * Atomic file rename = lock (Windows + POSIX both atomic within a volume).
 * No DB, no daemon required, no network.
 */

import { readFileSync, writeFileSync, readdirSync, renameSync, existsSync, mkdirSync, statSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

export const BUS_ROOT = "D:\\.agents\\command-bus";
export const INBOX = join(BUS_ROOT, "inbox");
export const ACTIVE = join(BUS_ROOT, "active");
export const DONE = join(BUS_ROOT, "done");

export type Provider = "claude-code" | "antigravity" | "codex" | string;
export type TaskStatus = "pending" | "claimed" | "done";

// ─── routing matrix ─────────────────────────────────────────────────────────

const ROUTING_MATRIX = "D:\\.agents\\routing-matrix.yaml";

export interface RouteEntry {
  provider: Provider;
  model: string;
}

let _matrixCache: Map<string, RouteEntry> | null = null;

export function loadRoutingMatrix(): Map<string, RouteEntry> {
  if (_matrixCache) return _matrixCache;

  const map = new Map<string, RouteEntry>();
  if (!existsSync(ROUTING_MATRIX)) {
    _matrixCache = map;
    return map;
  }

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
      map.set(inlineMatch[1], { provider: inlineMatch[2], model: inlineMatch[3] });
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
        map.set(blockMatch[1], { provider: providerMatch[1], model: modelMatch[1] });
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
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
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
  const dir = taskPath.substring(0, taskPath.lastIndexOf("\\"));
  const oldName = taskPath.substring(taskPath.lastIndexOf("\\") + 1);
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
  const dir = claimedPath.substring(0, claimedPath.lastIndexOf("\\"));
  const oldName = claimedPath.substring(claimedPath.lastIndexOf("\\") + 1);
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

/** Read all done task outputs in a session — context for next agent. */
export function loadSessionContext(sessionId: string): string {
  const tasks = listTasks(sessionId, "done");
  const dir = join(ACTIVE, sessionId, "tasks");
  const parts: string[] = [];

  for (const t of tasks) {
    const outPath = join(dir, `${t.task.id}.out.md`);
    if (!existsSync(outPath)) continue;
    parts.push(`## ${t.task.role} (task ${t.task.id})\n\nBrief: ${t.task.brief}\n\n---\n\n${readFileSync(outPath, "utf-8")}`);
  }

  return parts.join("\n\n---\n\n");
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
