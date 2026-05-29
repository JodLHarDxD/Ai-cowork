/**
 * Command bus CLI surface:
 *   jodl whoami     — show current provider + brain status
 *   jodl brief      — submit new project brief
 *   jodl next       — claim + run next task for this provider
 *   jodl status     — show queue
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";
import chalk from "chalk";
import type { Command } from "commander";

import {
  getProvider,
  genId,
  createSession,
  listActiveSessions,
  writeTask,
  listTasks,
  claimTask,
  markTaskDone,
  findNextTask,
  findTaskById,
  findClaimedPath,
  loadSessionContext,
  loadBrainContext,
  domainForRole,
  routeFor,
  readPendingEvents,
  evaluateEventForDomain,
  buildRuntimeOverrides,
  consumeEvent,
  broadcastEvent,
  type TaskFile,
  type SynapseEventType,
  type TaskDomain,
} from "../bus.js";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../../..");
const AGENTS_DIR = join(WORKSPACE_ROOT, "packages/jodl-system/agents");
const PROFILES_DIR = "D:\\.agents\\provider-profiles";

function loadBasePrompt(): string {
  const path = join(AGENTS_DIR, "AGENTS_BASE.md");
  return existsSync(path) ? readFileSync(path, "utf-8") : "";
}

const FEEDBACK_PATH = join(WORKSPACE_ROOT, "packages/jodl-system/graph/feedback-roles.json");

interface FeedbackStore {
  version: string;
  updated: string;
  scores: Record<string, { uses: number; done: number; failed: number }>;
  deprecated: string[];
  notes: string;
}

function recordFeedback(role: string, outcome: "done" | "failed"): void {
  if (!existsSync(FEEDBACK_PATH)) return;
  try {
    const store: FeedbackStore = JSON.parse(readFileSync(FEEDBACK_PATH, "utf-8"));
    if (!store.scores[role]) store.scores[role] = { uses: 0, done: 0, failed: 0 };
    store.scores[role]!.uses++;
    store.scores[role]![outcome]++;
    store.updated = new Date().toISOString().split("T")[0]!;
    writeFileSync(FEEDBACK_PATH, JSON.stringify(store, null, 2));
  } catch {
    // feedback is best-effort — never block task completion
  }
}

// ─── provider runners ────────────────────────────────────────────────────────

/** Execute via Anthropic Claude (streaming). */
async function runClaude(systemPrompt: string, brief: string, model: string, maxTokens = 8192): Promise<string> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });
  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: brief }],
  });

  let output = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      process.stdout.write(event.delta.text);
      output += event.delta.text;
    }
  }
  const finalMsg = await stream.finalMessage();
  console.log(chalk.gray(`\nTokens: ${finalMsg.usage.input_tokens} in / ${finalMsg.usage.output_tokens} out`));
  return output;
}

/** Execute via Google Gemini (streaming). */
async function runGemini(systemPrompt: string, brief: string, model: string, maxTokens = 8192): Promise<string> {
  const apiKey = process.env["GOOGLE_API_KEY"] ?? process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GOOGLE_API_KEY (or GEMINI_API_KEY) not set");

  // Dynamic import — @google/genai may not be installed yet; fail clearly
  let GoogleGenAI: typeof import("@google/genai").GoogleGenAI;
  try {
    ({ GoogleGenAI } = await import("@google/genai"));
  } catch {
    throw new Error("@google/genai not installed. Run: pnpm add @google/genai --filter @jodl/cli");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContentStream({
    model,
    config: { systemInstruction: systemPrompt, maxOutputTokens: maxTokens },
    contents: [{ role: "user", parts: [{ text: brief }] }],
  });

  let output = "";
  for await (const chunk of response) {
    const text = chunk.text ?? "";
    process.stdout.write(text);
    output += text;
  }
  return output;
}

/** Execute via OpenAI GPT (streaming). */
async function runOpenAI(systemPrompt: string, brief: string, model: string, maxTokens = 8192): Promise<string> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const client = new OpenAI({ apiKey });
  const stream = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: brief },
    ],
  });

  let output = "";
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    process.stdout.write(text);
    output += text;
  }
  return output;
}

/** Dispatch to correct provider runner. Returns model output string. */
async function executeTask(task: TaskFile, systemPrompt: string): Promise<string> {
  const model = task.assignedModel ?? "claude-sonnet-4-6";
  switch (task.assignedProvider) {
    case "claude-code":
      return runClaude(systemPrompt, task.brief, model);
    case "antigravity":
      return runGemini(systemPrompt, task.brief, model);
    case "codex":
      return runOpenAI(systemPrompt, task.brief, model);
    default:
      throw new Error(
        `Unknown provider "${task.assignedProvider}" — no auto-runner. ` +
        `Use: jodl claim ${task.id}  then paste into your AI  then: jodl submit ${task.id}`
      );
  }
}

// ─── whoami ─────────────────────────────────────────────────────────────────

function whoami(): void {
  let provider: string;
  try {
    provider = getProvider();
  } catch (e) {
    console.log(chalk.red("✗ JODL_PROVIDER not set"));
    console.log();
    console.log("Set it for this shell:");
    console.log(chalk.cyan('  PowerShell: $env:JODL_PROVIDER = "claude-code"'));
    console.log(chalk.cyan('  Bash:       export JODL_PROVIDER=claude-code'));
    console.log();
    console.log("Values: claude-code | antigravity | codex");
    process.exit(1);
  }

  const profilePath = join(PROFILES_DIR, `${provider}.yaml`);
  const profileExists = existsSync(profilePath);

  const keys = {
    "ANTHROPIC_API_KEY":          { label: "Claude (claude-code)", present: !!process.env["ANTHROPIC_API_KEY"] },
    "GOOGLE_API_KEY / GEMINI_API_KEY": { label: "Gemini (antigravity)", present: !!(process.env["GOOGLE_API_KEY"] ?? process.env["GEMINI_API_KEY"]) },
    "OPENAI_API_KEY":              { label: "GPT (codex)",         present: !!process.env["OPENAI_API_KEY"] },
  };

  console.log(chalk.bold(`\n👤 Provider: ${chalk.cyan(provider)}`));
  console.log(`   Profile:  ${profileExists ? chalk.green("✓ " + profilePath) : chalk.yellow("✗ not declared — paste PROVIDER_INTRO.md to your AI first")}`);
  console.log(`   API keys:`);
  for (const [key, info] of Object.entries(keys)) {
    const status = info.present ? chalk.green(`✓`) : chalk.yellow(`✗`);
    const label  = info.present ? chalk.green(info.label) : chalk.yellow(`${info.label} (${key} missing)`);
    console.log(`     ${status} ${label}`);
  }

  const sessions = listActiveSessions();
  console.log(`   Active sessions: ${sessions.length}`);
  for (const s of sessions) {
    const tasks = listTasks(s.id);
    const pending = tasks.filter((t) => t.status === "pending" && t.task.assignedProvider === provider).length;
    console.log(`     ${chalk.gray(s.id)} ${chalk.bold(s.phase)} — ${pending > 0 ? chalk.yellow(`${pending} task(s) for you`) : chalk.gray("nothing pending")}`);
  }
  console.log();
}

// ─── brief ──────────────────────────────────────────────────────────────────

async function brief(text: string, opts: { skipResearch?: boolean; phase?: string }): Promise<void> {
  const provider = getProvider();
  const session = createSession(text, provider);

  console.log(chalk.bold(`\n📋 Session ${chalk.cyan(session.id)} created`));
  console.log(chalk.gray(`   by: ${provider}`));
  console.log(chalk.gray(`   brief: ${text.substring(0, 80)}${text.length > 80 ? "..." : ""}\n`));

  // Spawn master-orchestrator task — looked up from routing matrix
  const route = routeFor("master-orchestrator") ?? { provider: "claude-code", model: "claude-opus-4-7" };

  const masterTask: TaskFile = {
    id: genId(""),
    sessionId: session.id,
    role: "master-orchestrator",
    assignedProvider: route.provider,
    assignedModel: route.model,
    brief: `CEO brief:\n${text}\n\nYour job: parse this brief, decide which domains are needed, spawn domain orchestrator tasks.\n\nMust output JSON block at end with spawn-tasks array (see your system prompt).\n\nOptions:\n- skip-research: ${opts.skipResearch ?? false}\n- target-phase: ${opts.phase ?? "design"}`,
    dependsOn: [],
    phase: "design",
  };
  writeTask(session.id, masterTask);

  console.log(chalk.bold(`✓ Master orchestrator task spawned`));
  console.log(`  Role:     master-orchestrator`);
  console.log(`  Provider: ${chalk.cyan(route.provider)} (${route.model})`);
  console.log(`  Task ID:  ${masterTask.id}\n`);

  if (route.provider === provider) {
    console.log(chalk.green(`This platform owns master-orchestrator.`));
    console.log(`Run: ${chalk.cyan("pnpm jodl next")} to execute it.\n`);
  } else {
    console.log(chalk.yellow(`Switch to ${route.provider} and run ${chalk.cyan("jodl next")} there.\n`));
  }
}

/** Parse JSON block from orchestrator output, create child tasks. */
function parseAndSpawnChildren(sessionId: string, parentTaskId: string, output: string): number {
  // Look for ```json ... ``` block at end of output
  const match = output.match(/```json\s*([\s\S]*?)```\s*$/);
  if (!match) {
    // Also try without code fence
    const lastBrace = output.lastIndexOf("{");
    if (lastBrace === -1) return 0;
    try {
      const candidate = output.substring(lastBrace);
      const parsed = JSON.parse(candidate);
      return spawnFromParsed(sessionId, parentTaskId, parsed);
    } catch {
      return 0;
    }
  }

  try {
    const parsed = JSON.parse(match[1]!);
    return spawnFromParsed(sessionId, parentTaskId, parsed);
  } catch (e) {
    console.error(chalk.yellow(`⚠ Failed to parse spawn-tasks JSON: ${e instanceof Error ? e.message : e}`));
    return 0;
  }
}

function spawnFromParsed(sessionId: string, parentTaskId: string, parsed: { "spawn-tasks"?: Array<{ role: string; brief: string; "depends-on"?: string[]; "parallel-group"?: number }>; phase?: string }): number {
  const tasks = parsed["spawn-tasks"];
  if (!Array.isArray(tasks)) {
    console.error(chalk.red(`✗ spawn-tasks missing or not an array. Orchestrator output must end with JSON block containing "spawn-tasks": [...]`));
    return 0;
  }

  let spawned = 0;

  // Map placeholder dep refs to real task ids (pre-pass for all valid tasks)
  const idMap = new Map<string, string>();
  for (const t of tasks) {
    if (t.role && t.brief) idMap.set(t.role, genId(""));
  }

  for (const t of tasks) {
    if (!t.role || !t.brief) {
      console.error(chalk.red(`✗ Spawn task missing required field(s). Got: ${JSON.stringify(t)}. Required: { role, brief }. Skipping.`));
      continue;
    }
    const newId = idMap.get(t.role)!;
    const route = routeFor(t.role);
    if (!route) {
      console.warn(chalk.yellow(`⚠ No routing-matrix entry for role "${t.role}". Defaulting to claude-code. Add to D:\\.agents\\routing-matrix.yaml.`));
    }
    const deps = (t["depends-on"] ?? []).map((d) => {
      // dep could be a role name (resolve via idMap) or already a task id
      return idMap.get(d) ?? d;
    });

    const child: TaskFile = {
      id: newId,
      sessionId,
      role: t.role,
      assignedProvider: route?.provider ?? "claude-code",
      assignedModel: route?.model,
      brief: t.brief,
      dependsOn: deps,
      phase: (parsed.phase ?? "design") as TaskFile["phase"],
      parallelGroup: t["parallel-group"],
    };
    writeTask(sessionId, child);
    spawned++;
  }
  return spawned;
}

// ─── next ───────────────────────────────────────────────────────────────────

async function next(opts: { sessionId?: string; dryRun?: boolean; forceReclaim?: string }): Promise<void> {
  const provider = getProvider();

  // --force-reclaim <taskId>: rename claimed-<X>-<id> → pending-<id> so it can be re-picked
  if (opts.forceReclaim) {
    const { renameSync, readdirSync: rd } = await import("fs");
    const { join: pjoin } = await import("path");
    const { ACTIVE } = await import("../bus.js");
    const { listActiveSessions: las } = await import("../bus.js");
    for (const s of las()) {
      const dir = pjoin(ACTIVE, s.id, "tasks");
      try {
        for (const f of rd(dir)) {
          if (f.includes(opts.forceReclaim) && f.startsWith("claimed-")) {
            const oldPath = pjoin(dir, f);
            const newPath = pjoin(dir, `pending-${opts.forceReclaim}.yaml`);
            renameSync(oldPath, newPath);
            console.log(chalk.green(`✓ Reclaimed: ${opts.forceReclaim} → pending`));
            return;
          }
        }
      } catch {}
    }
    console.error(chalk.red(`✗ Task ${opts.forceReclaim} not found in claimed state.\n`));
    process.exit(1);
  }

  const found = findNextTask(provider, opts.sessionId);

  if (!found) {
    console.log(chalk.gray(`\n✓ No pending tasks for ${chalk.cyan(provider)}.\n`));
    return;
  }

  console.log(chalk.bold(`\n📌 Task ${chalk.cyan(found.task.id)} — ${found.task.role}`));
  console.log(chalk.gray(`   session: ${found.sessionId}`));
  console.log(chalk.gray(`   phase: ${found.task.phase}`));
  console.log(chalk.gray(`   brief: ${found.task.brief.substring(0, 100)}...`));

  if (opts.dryRun) {
    console.log(chalk.yellow(`\n(dry-run — not claiming)\n`));
    return;
  }

  const claimedPath = claimTask(found.path, provider);
  if (!claimedPath) {
    console.log(chalk.red(`\n✗ Lost race — another provider claimed it first. Try again.\n`));
    return;
  }
  console.log(chalk.green(`\n✓ Claimed.`));

  // Load system prompt (fallback to generic if not defined)
  const systemPromptPath = join(AGENTS_DIR, found.task.role, "system-prompt.md");
  let systemPrompt = existsSync(systemPromptPath)
    ? readFileSync(systemPromptPath, "utf-8")
    : `You are the ${found.task.role} agent in the jodl-orchestration system.`;

  // Domain-scoped context: orchestrators get all, leaf agents get own domain + orch outputs
  const taskDomain = domainForRole(found.task.role);
  const sessionContext = loadSessionContext(found.sessionId, taskDomain);
  const brainContext = loadBrainContext();

  // SYNAPSE: check for broadcast events relevant to this domain
  const { overrides, count: eventCount } = checkEvents(taskDomain);
  if (eventCount > 0) {
    console.log(chalk.yellow(`\n⚡ ${eventCount} SYNAPSE event(s) applied:`));
    for (const note of overrides.notes ?? []) console.log(chalk.yellow(`   ${note}`));
  }

  // If this provider is flagged unavailable, abort execution and return task to pending
  if (overrides.skipProviders?.includes(found.task.assignedProvider)) {
    console.log(chalk.red(`\n✗ Provider ${found.task.assignedProvider} marked unavailable by SYNAPSE event.`));
    console.log(chalk.gray(`  Returning task to pending. Fix the provider issue then retry.\n`));
    const { renameSync } = await import("fs");
    renameSync(claimedPath, found.path);
    return;
  }

  const runtimeAlerts = overrides.notes?.length
    ? `\n\n---\n\n## Runtime Alerts\n\n${overrides.notes.map((n) => `- ${n}`).join("\n")}`
    : "";
  const maxTokens = overrides.maxTokens ?? 8192;
  const basePrompt = loadBasePrompt();

  const fullSystem = [
    basePrompt     ? basePrompt                                             : null,
    systemPrompt,
    brainContext   ? `---\n\n${brainContext}`                               : null,
    sessionContext ? `---\n\n## Prior session outputs\n\n${sessionContext}` : null,
  ].filter(Boolean).join("\n\n") + runtimeAlerts;

  if (overrides.delayMs) {
    const delay = overrides.delayMs;
    console.log(chalk.gray(`⏳ Delaying ${delay}ms (rate-limit back-off)...`));
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }

  console.log(chalk.bold(`\n🤖 Running ${chalk.cyan(found.task.assignedProvider)} agent (${found.task.assignedModel ?? "default model"})...\n`));
  console.log(chalk.bold("─".repeat(60)));

  let output: string;
  try {
    const model = found.task.assignedModel ?? process.env["JODL_MODEL"] ?? "claude-sonnet-4-6";
    switch (found.task.assignedProvider) {
      case "claude-code":
        output = await runClaude(fullSystem, found.task.brief, model, maxTokens);
        break;
      case "antigravity":
        output = await runGemini(fullSystem, found.task.brief, model, maxTokens);
        break;
      case "codex":
        output = await runOpenAI(fullSystem, found.task.brief, model, maxTokens);
        break;
      default: {
        console.log(chalk.yellow(`\n⚠ No auto-runner for provider "${found.task.assignedProvider}".`));
        console.log(chalk.gray(`  Task is claimed. Use: ${chalk.cyan(`jodl submit ${found.task.id} -f <output-file>`)}\n`));
        return;
      }
    }
  } catch (err) {
    console.error(chalk.bold("\n─".repeat(60)));
    console.error(chalk.red(`\n✗ Execution failed: ${err instanceof Error ? err.message : err}`));
    console.error(chalk.gray(`  Task remains claimed at: ${claimedPath}`));
    console.error(chalk.gray(`  Fix the error then run: jodl submit ${found.task.id} -f <output-file>\n`));
    recordFeedback(found.task.role, "failed");
    process.exit(1);
  }

  console.log("\n" + chalk.bold("─".repeat(60)));

  markTaskDone(claimedPath, output);
  recordFeedback(found.task.role, "done");
  console.log(chalk.green(`✓ Task done.`));

  // Any agent can spawn new tasks — not just orchestrators.
  // A leaf agent discovering a cross-domain gap (e.g. frontend-master finding an
  // API contract mismatch) outputs {"spawn-tasks":[...]} and the bus re-routes it.
  const spawned = parseAndSpawnChildren(found.sessionId, found.task.id, output);
  if (spawned > 0) {
    console.log(chalk.bold(`\n🌱 Spawned ${spawned} child task(s).`));
    console.log(chalk.gray(`   Run ${chalk.cyan("jodl status")} to see which platform owns each.\n`));
  } else if (found.task.role.endsWith("-orchestrator")) {
    console.log(chalk.yellow(`\n⚠ No spawn-tasks JSON found in orchestrator output — no children created.\n`));
  } else {
    console.log();
  }
}

// ─── daemon ─────────────────────────────────────────────────────────────────

/**
 * Auto-claim loop — runs tasks as they appear, re-wakes when new work is spawned.
 *
 * Flow per iteration:
 *   1. findNextTask  → if found: claim + execute + parse spawn-tasks → loop immediately
 *   2. if nothing:  sleep --interval seconds → check again
 *
 * This makes dynamic re-engagement automatic: if impl-orchestrator spawns an
 * architect review task mid-session, the claude-code daemon picks it up on its
 * next poll without any human intervention.
 */
async function daemon(opts: { maxTasks?: number; interval?: number; sessionId?: string }): Promise<void> {
  const provider = getProvider();
  const maxTasks  = opts.maxTasks  ?? Infinity;
  const intervalMs = (opts.interval ?? 5) * 1000;
  let count = 0;
  let idle = false;

  console.log(chalk.bold(`\n🔄 Daemon started`));
  console.log(chalk.gray(`   provider:   ${provider}`));
  console.log(chalk.gray(`   max-tasks:  ${maxTasks === Infinity ? "unlimited" : maxTasks}`));
  console.log(chalk.gray(`   poll:       ${opts.interval ?? 5}s when idle`));
  console.log(chalk.gray(`   Ctrl+C to stop\n`));

  while (count < maxTasks) {
    const found = findNextTask(provider, opts.sessionId);

    if (!found) {
      if (!idle) {
        process.stdout.write(chalk.gray(`\nIdle — polling every ${opts.interval ?? 5}s for new tasks...`));
        idle = true;
      } else {
        process.stdout.write(chalk.gray("."));
      }
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
      continue;
    }

    if (idle) {
      process.stdout.write("\n");
      idle = false;
    }

    console.log(chalk.bold(`\n📌 Task ${chalk.cyan(found.task.id)} — ${found.task.role}`));
    console.log(chalk.gray(`   session: ${found.sessionId}  phase: ${found.task.phase}`));

    const claimedPath = claimTask(found.path, provider);
    if (!claimedPath) {
      console.log(chalk.yellow(`Lost race on ${found.task.id} — retrying...\n`));
      continue;
    }

    const systemPromptPath = join(AGENTS_DIR, found.task.role, "system-prompt.md");
    const systemPrompt = existsSync(systemPromptPath)
      ? readFileSync(systemPromptPath, "utf-8")
      : `You are the ${found.task.role} agent in the jodl-orchestration system.`;

    const taskDomain   = domainForRole(found.task.role);
    const sessionCtx   = loadSessionContext(found.sessionId, taskDomain);
    const brainCtx     = loadBrainContext();

    // SYNAPSE: check broadcast events for this domain
    const { overrides: dOverrides, count: dEventCount } = checkEvents(taskDomain);
    if (dEventCount > 0) {
      console.log(chalk.yellow(`⚡ ${dEventCount} SYNAPSE event(s):`));
      for (const note of dOverrides.notes ?? []) console.log(chalk.yellow(`   ${note}`));
    }

    // If this provider is flagged unavailable, return task to pending and skip
    if (dOverrides.skipProviders?.includes(found.task.assignedProvider)) {
      console.log(chalk.red(`✗ Provider ${found.task.assignedProvider} unavailable — returning task to pending.`));
      const { renameSync } = await import("fs");
      renameSync(claimedPath, found.path);
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
      continue;
    }

    const runtimeAlerts = dOverrides.notes?.length
      ? `\n\n---\n\n## Runtime Alerts\n\n${dOverrides.notes.map((n) => `- ${n}`).join("\n")}`
      : "";
    const dMaxTokens = dOverrides.maxTokens ?? 8192;
    const dBasePrompt = loadBasePrompt();

    const fullSystem   = [
      dBasePrompt ? dBasePrompt                                          : null,
      systemPrompt,
      brainCtx   ? `---\n\n${brainCtx}`                                 : null,
      sessionCtx ? `---\n\n## Prior session outputs\n\n${sessionCtx}`   : null,
    ].filter(Boolean).join("\n\n") + runtimeAlerts;

    if (dOverrides.delayMs) {
      const dDelay = dOverrides.delayMs;
      console.log(chalk.gray(`⏳ Back-off ${dDelay}ms...`));
      await new Promise<void>((resolve) => setTimeout(resolve, dDelay));
    }

    console.log(chalk.bold(`\n🤖 Running ${chalk.cyan(found.task.assignedProvider)} (${found.task.assignedModel ?? "default"})...`));
    console.log(chalk.bold("─".repeat(60)));

    let output: string;
    try {
      const model = found.task.assignedModel ?? process.env["JODL_MODEL"] ?? "claude-sonnet-4-6";
      switch (found.task.assignedProvider) {
        case "claude-code": output = await runClaude(fullSystem, found.task.brief, model, dMaxTokens); break;
        case "antigravity": output = await runGemini(fullSystem, found.task.brief, model, dMaxTokens); break;
        case "codex":       output = await runOpenAI(fullSystem, found.task.brief, model, dMaxTokens); break;
        default:
          console.log(chalk.yellow(`No auto-runner for "${found.task.assignedProvider}" — skipping. Use jodl claim ${found.task.id}`));
          continue;
      }
    } catch (err) {
      console.error(chalk.bold("\n─".repeat(60)));
      console.error(chalk.red(`✗ Execution failed: ${err instanceof Error ? err.message : err}`));
      console.error(chalk.gray(`  Task remains claimed. Fix error then: jodl submit ${found.task.id} -f <file>`));
      recordFeedback(found.task.role, "failed");
      // Don't exit — keep daemon alive for next task
      count++;
      continue;
    }

    console.log("\n" + chalk.bold("─".repeat(60)));
    markTaskDone(claimedPath, output);
    recordFeedback(found.task.role, "done");
    count++;
    console.log(chalk.green(`✓ Done (${count}${maxTasks !== Infinity ? "/" + maxTasks : ""}).`));

    const spawned = parseAndSpawnChildren(found.sessionId, found.task.id, output);
    if (spawned > 0) {
      console.log(chalk.bold(`🌱 Spawned ${spawned} child task(s) — looping immediately.\n`));
      // Don't sleep — new work just appeared, go claim it right away
    } else if (found.task.role.endsWith("-orchestrator")) {
      console.log(chalk.yellow(`⚠ No spawn-tasks JSON in orchestrator output.\n`));
    }
  }

  console.log(chalk.bold(`\n✓ Daemon reached max-tasks (${maxTasks}). Exiting.\n`));
}

// ─── status ─────────────────────────────────────────────────────────────────

function status(sessionId?: string): void {
  const sessions = sessionId
    ? [{ id: sessionId, brief: "", phase: "design" as const, createdAt: "", createdBy: "" }]
    : listActiveSessions();

  if (sessions.length === 0) {
    console.log(chalk.gray("\nNo active sessions.\n"));
    return;
  }

  console.log(chalk.bold(`\n📊 Active sessions: ${sessions.length}\n`));

  for (const s of sessions) {
    const tasks = listTasks(s.id);
    const pending = tasks.filter((t) => t.status === "pending");
    const claimed = tasks.filter((t) => t.status === "claimed");
    const done = tasks.filter((t) => t.status === "done");

    console.log(chalk.bold(`${chalk.cyan(s.id)} ${chalk.gray("phase=" + s.phase)}`));
    console.log(`  pending: ${chalk.yellow(pending.length)} | claimed: ${chalk.blue(claimed.length)} | done: ${chalk.green(done.length)}`);

    for (const t of pending) {
      console.log(`    ⏳ ${chalk.gray(t.task.id)} ${t.task.role} → ${chalk.cyan(t.task.assignedProvider)}`);
    }
    for (const t of claimed) {
      console.log(`    🔒 ${chalk.gray(t.task.id)} ${t.task.role} → ${chalk.blue(t.claimedBy)}`);
    }
    for (const t of done) {
      console.log(`    ✓  ${chalk.gray(t.task.id)} ${t.task.role}`);
    }
    console.log();
  }
}

// ─── claim (manual — no API) ─────────────────────────────────────────────────

function claimManual(taskId: string): void {
  const provider = getProvider();
  const found = findTaskById(taskId);

  if (!found) {
    console.error(chalk.red(`\n✗ Task ${taskId} not found in any active session.\n`));
    process.exit(1);
  }
  if (found.status !== "pending") {
    console.error(chalk.red(`\n✗ Task ${taskId} is ${found.status}, not pending.\n`));
    process.exit(1);
  }
  if (found.task.assignedProvider !== provider) {
    console.log(chalk.yellow(`⚠ Task assigned to ${found.task.assignedProvider}, you are ${provider}. Claiming anyway.`));
  }

  const claimedPath = claimTask(found.path, provider);
  if (!claimedPath) {
    console.error(chalk.red(`\n✗ Lost race — another provider claimed it. Run: jodl status\n`));
    process.exit(1);
  }

  const systemPromptPath = join(AGENTS_DIR, found.task.role, "system-prompt.md");
  const taskDomain = domainForRole(found.task.role);
  const sessionContext = loadSessionContext(found.sessionId, taskDomain);
  const brainContext = loadBrainContext();

  console.log(chalk.bold(`\n✓ Claimed: ${chalk.cyan(found.task.id)}`));
  console.log(chalk.gray(`   session: ${found.sessionId}`));
  console.log(chalk.gray(`   role:    ${found.task.role}`));
  console.log();
  console.log(chalk.bold("─── SYSTEM PROMPT ──────────────────────────────────────────────────────────"));
  if (existsSync(systemPromptPath)) {
    console.log(readFileSync(systemPromptPath, "utf-8"));
  } else {
    console.log(`You are the ${found.task.role} agent in the jodl-orchestration system.`);
  }
  if (brainContext) {
    console.log(chalk.bold("\n─── SHARED BRAIN (mistakes + patterns) ─────────────────────────────────────"));
    console.log(brainContext);
  }
  if (sessionContext) {
    console.log(chalk.bold("\n─── PRIOR SESSION OUTPUTS ──────────────────────────────────────────────────"));
    console.log(sessionContext.substring(0, 3000) + (sessionContext.length > 3000 ? "\n[... truncated — full context in task file]" : ""));
  }
  console.log(chalk.bold("\n─── YOUR TASK BRIEF ────────────────────────────────────────────────────────"));
  console.log(found.task.brief);
  console.log(chalk.bold("────────────────────────────────────────────────────────────────────────────"));
  console.log();
  console.log(chalk.bold("Next steps:"));
  console.log(`  1. Copy the system prompt + brief above → paste into your AI (Claude/Gemini/GPT)`);
  console.log(`  2. Get AI output`);
  console.log(`  3. Run: ${chalk.cyan(`pnpm jodl submit ${taskId}`)}`);
  console.log(`     (paste output when prompted, press Ctrl+D / Ctrl+Z to finish)\n`);
}

// ─── submit (manual — no API) ─────────────────────────────────────────────────

async function submitManual(taskId: string, opts: { file?: string }): Promise<void> {
  const provider = getProvider();
  const claimedPath = findClaimedPath(taskId, provider);

  if (!claimedPath) {
    console.error(chalk.red(`\n✗ No claimed task ${taskId} for ${provider}. Run: jodl claim ${taskId} first.\n`));
    process.exit(1);
  }

  let output = "";

  if (opts.file) {
    if (!existsSync(opts.file)) {
      console.error(chalk.red(`\n✗ File not found: ${opts.file}\n`));
      process.exit(1);
    }
    output = readFileSync(opts.file, "utf-8");
    console.log(chalk.gray(`Reading output from: ${opts.file}`));
  } else {
    // Read from stdin
    console.log(chalk.bold(`\nPaste AI output below. Press Ctrl+D (Linux/Mac) or Ctrl+Z then Enter (Windows) when done:\n`));
    console.log(chalk.bold("────────────────────────────────────────────────────────────────────────────"));
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    output = Buffer.concat(chunks).toString("utf-8");
    console.log(chalk.bold("────────────────────────────────────────────────────────────────────────────"));
  }

  if (!output.trim()) {
    console.error(chalk.red("\n✗ Empty output. Task not submitted.\n"));
    process.exit(1);
  }

  // Find session for spawn-tasks parsing
  const found = findTaskById(taskId);
  const sessionId = found?.sessionId ?? "";

  markTaskDone(claimedPath, output);
  console.log(chalk.green(`\n✓ Task ${taskId} marked done.`));

  if (sessionId) {
    const spawned = parseAndSpawnChildren(sessionId, taskId, output);
    if (spawned > 0) {
      console.log(chalk.bold(`\n🌱 Spawned ${spawned} child task(s).`));
      console.log(chalk.gray(`   Run ${chalk.cyan("jodl status")} to see which platform owns each.\n`));
    } else if (found?.task.role.endsWith("-orchestrator")) {
      console.log(chalk.yellow(`\n⚠ No spawn-tasks JSON found — no children created.\n`));
      console.log(chalk.gray(`  Orchestrator output must end with a \`\`\`json block containing "spawn-tasks".\n`));
    } else {
      console.log(chalk.gray(`   Run ${chalk.cyan("jodl status")} to see updated queue.\n`));
    }
  }
}

// ─── synapse event helpers ────────────────────────────────────────────────────

/**
 * Read pending events, filter to domain, consume them, return overrides.
 * Called once per task execution — events are consumed after reading so
 * concurrent daemon instances don't double-apply them.
 */
function checkEvents(domain: TaskDomain): { overrides: ReturnType<typeof buildRuntimeOverrides>; count: number } {
  const pending = readPendingEvents();
  const relevant = pending.filter(({ event }) => evaluateEventForDomain(event, domain));
  if (relevant.length === 0) return { overrides: {}, count: 0 };

  const overrides = buildRuntimeOverrides(relevant.map(({ event }) => event));
  for (const { path } of relevant) consumeEvent(path);
  return { overrides, count: relevant.length };
}

function emitEvent(type: string, domain: string, payloadJson?: string): void {
  const validTypes: SynapseEventType[] = [
    "API_RATE_LIMIT_WARNING",
    "PROVIDER_UNAVAILABLE",
    "SCHEMA_DEPRECATION",
    "TASK_FAILED",
    "CODEBASE_CHANGED",
  ];
  if (!validTypes.includes(type as SynapseEventType)) {
    console.error(chalk.red(`✗ Unknown event type "${type}". Valid: ${validTypes.join(", ")}`));
    process.exit(1);
  }
  const validDomains = ["design", "architecture", "implementation", "security", "ship", "meta", "all"];
  if (!validDomains.includes(domain)) {
    console.error(chalk.red(`✗ Unknown domain "${domain}". Valid: ${validDomains.join(", ")}`));
    process.exit(1);
  }

  let payload: Record<string, unknown> = {};
  if (payloadJson) {
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      console.error(chalk.red(`✗ Invalid JSON payload: ${payloadJson}`));
      process.exit(1);
    }
  }

  const provider = getProvider();
  const event = broadcastEvent({
    type: type as SynapseEventType,
    domain: domain as TaskDomain | "all",
    severity: domain === "all" ? "critical" : "warning",
    payload,
    source: provider,
  });
  console.log(chalk.green(`✓ Event broadcast: ${chalk.cyan(event.id)}`));
  console.log(chalk.gray(`   type:   ${event.type}`));
  console.log(chalk.gray(`   domain: ${event.domain}`));
  console.log(chalk.gray(`   file:   ${event.id}\n`));
}

// ─── register ───────────────────────────────────────────────────────────────

export function registerBusCommands(program: Command): void {
  program
    .command("whoami")
    .description("Show current provider + brain status")
    .action(whoami);

  program
    .command("brief <text>")
    .description("Submit a new project brief (any platform)")
    .option("--skip-research", "Skip research-master phase")
    .option("--phase <name>", "Target phase (design|build|ship)", "design")
    .action(async (text: string, opts: { skipResearch?: boolean; phase?: string }) => {
      await brief(text, opts);
    });

  program
    .command("next")
    .description("Claim + run next task for your provider")
    .option("-s, --session-id <id>", "Limit to a specific session")
    .option("--dry-run", "Show next task without claiming")
    .option("--force-reclaim <taskId>", "Reset a stuck claimed task back to pending")
    .action(async (opts: { sessionId?: string; dryRun?: boolean; forceReclaim?: string }) => {
      await next(opts);
    });

  program
    .command("daemon")
    .description("Auto-claim loop — executes tasks as they appear, re-wakes when new work is spawned")
    .option("-n, --max-tasks <n>", "Stop after N tasks (default: unlimited)")
    .option("-i, --interval <seconds>", "Poll interval when idle (default: 5s)", "5")
    .option("-s, --session-id <id>", "Limit to a specific session")
    .action(async (opts: { maxTasks?: string; interval?: string; sessionId?: string }) => {
      await daemon({
        maxTasks:  opts.maxTasks  ? parseInt(opts.maxTasks)  : undefined,
        interval:  opts.interval  ? parseInt(opts.interval)  : undefined,
        sessionId: opts.sessionId,
      });
    });

  program
    .command("status [sessionId]")
    .description("Show queue state for all or one session")
    .action((sessionId?: string) => {
      status(sessionId);
    });

  program
    .command("claim <taskId>")
    .description("Manually claim a task (no API key needed) — prints brief for your AI")
    .action((taskId: string) => {
      claimManual(taskId);
    });

  program
    .command("submit <taskId>")
    .description("Submit AI output for a claimed task (no API key needed)")
    .option("-f, --file <path>", "Read output from file instead of stdin")
    .action(async (taskId: string, opts: { file?: string }) => {
      await submitManual(taskId, opts);
    });

  program
    .command("emit <type> <domain> [payload]")
    .description(
      "Broadcast a SYNAPSE event to all daemons\n" +
      "  types:   API_RATE_LIMIT_WARNING | PROVIDER_UNAVAILABLE | SCHEMA_DEPRECATION | TASK_FAILED | CODEBASE_CHANGED\n" +
      "  domains: design | architecture | implementation | security | ship | meta | all\n" +
      "  payload: optional JSON string, e.g. '{\"provider\":\"codex\"}'"
    )
    .action((type: string, domain: string, payload?: string) => {
      emitEvent(type, domain, payload);
    });
}
