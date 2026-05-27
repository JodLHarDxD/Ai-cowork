/**
 * Command bus CLI surface:
 *   jodl whoami     — show current provider + brain status
 *   jodl brief      — submit new project brief
 *   jodl next       — claim + run next task for this provider
 *   jodl status     — show queue
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { readFileSync, existsSync, readdirSync } from "fs";
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
  domainForRole,
  routeFor,
  type TaskFile,
} from "../bus.js";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../../..");
const AGENTS_DIR = join(WORKSPACE_ROOT, "packages/jodl-system/agents");
const PROFILES_DIR = "D:\\.agents\\provider-profiles";

// ─── provider runners ────────────────────────────────────────────────────────

/** Execute via Anthropic Claude (streaming). */
async function runClaude(systemPrompt: string, brief: string, model: string): Promise<string> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });
  const stream = client.messages.stream({
    model,
    max_tokens: 8192,
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
async function runGemini(systemPrompt: string, brief: string, model: string): Promise<string> {
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
    config: { systemInstruction: systemPrompt, maxOutputTokens: 8192 },
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
async function runOpenAI(systemPrompt: string, brief: string, model: string): Promise<string> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const client = new OpenAI({ apiKey });
  const stream = await client.chat.completions.create({
    model,
    max_tokens: 8192,
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
    const parsed = JSON.parse(match[1]);
    return spawnFromParsed(sessionId, parentTaskId, parsed);
  } catch (e) {
    console.error(chalk.yellow(`⚠ Failed to parse spawn-tasks JSON: ${e instanceof Error ? e.message : e}`));
    return 0;
  }
}

function spawnFromParsed(sessionId: string, parentTaskId: string, parsed: { "spawn-tasks"?: Array<{ role: string; brief: string; "depends-on"?: string[]; "parallel-group"?: number }>; phase?: string }): number {
  const tasks = parsed["spawn-tasks"];
  if (!Array.isArray(tasks)) return 0;

  // Map placeholder dep refs to real task ids
  const idMap = new Map<string, string>();
  for (const t of tasks) {
    idMap.set(t.role, genId(""));
  }

  for (const t of tasks) {
    const newId = idMap.get(t.role)!;
    const route = routeFor(t.role);
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
  }
  return tasks.length;
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
  const fullSystem = sessionContext
    ? `${systemPrompt}\n\n---\n\n## Prior session outputs\n\n${sessionContext}`
    : systemPrompt;

  const taskWithFullSystem: TaskFile = { ...found.task, brief: found.task.brief };

  console.log(chalk.bold(`\n🤖 Running ${chalk.cyan(found.task.assignedProvider)} agent (${found.task.assignedModel ?? "default model"})...\n`));
  console.log(chalk.bold("─".repeat(60)));

  let output: string;
  try {
    // executeTask uses the stored model but passes fullSystem as systemPrompt
    const model = found.task.assignedModel ?? process.env["JODL_MODEL"] ?? "claude-sonnet-4-6";
    switch (found.task.assignedProvider) {
      case "claude-code":
        output = await runClaude(fullSystem, found.task.brief, model);
        break;
      case "antigravity":
        output = await runGemini(fullSystem, found.task.brief, model);
        break;
      case "codex":
        output = await runOpenAI(fullSystem, found.task.brief, model);
        break;
      default: {
        // Unknown provider — print brief for manual copy-paste
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
    process.exit(1);
  }

  console.log("\n" + chalk.bold("─".repeat(60)));

  markTaskDone(claimedPath, output);
  console.log(chalk.green(`✓ Task done.`));

  // Orchestrators parse spawn-tasks JSON and create children
  if (found.task.role.endsWith("-orchestrator")) {
    const spawned = parseAndSpawnChildren(found.sessionId, found.task.id, output);
    if (spawned > 0) {
      console.log(chalk.bold(`\n🌱 Spawned ${spawned} child task(s).`));
      console.log(chalk.gray(`   Run ${chalk.cyan("jodl status")} to see which platform owns each.\n`));
    } else {
      console.log(chalk.yellow(`\n⚠ No spawn-tasks JSON found in orchestrator output — no children created.\n`));
    }
  } else {
    console.log();
  }
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
  const sessionContext = loadSessionContext(found.sessionId);

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

  if (found?.task.role.endsWith("-orchestrator") && sessionId) {
    const spawned = parseAndSpawnChildren(sessionId, taskId, output);
    if (spawned > 0) {
      console.log(chalk.bold(`\n🌱 Spawned ${spawned} child task(s).`));
      console.log(chalk.gray(`   Run ${chalk.cyan("jodl status")} to see which platform owns each.\n`));
    } else {
      console.log(chalk.yellow(`\n⚠ No spawn-tasks JSON found — no children created.\n`));
      console.log(chalk.gray(`  Orchestrator output must end with a \`\`\`json block containing "spawn-tasks".\n`));
    }
  } else {
    console.log(chalk.gray(`   Run ${chalk.cyan("jodl status")} to see updated queue.\n`));
  }
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
}
