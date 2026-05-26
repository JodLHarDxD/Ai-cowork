/**
 * jodl watch — live dashboard for the command bus.
 *
 * Watches D:\.agents\command-bus\active\ for state changes.
 * Notifies which provider has work waiting.
 *
 * Run in a dedicated terminal — leave open.
 */

import { watch, existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import type { Command } from "commander";

const BUS_ACTIVE = "D:\\.agents\\command-bus\\active";

interface PendingTask {
  taskId: string;
  role: string;
  provider: string;
  sessionId: string;
  brief: string;
  depsOk: boolean;
}

function parseTaskYaml(content: string): { role: string; assignedProvider: string; brief: string; dependsOn: string[] } {
  const lines = content.split("\n");
  const get = (key: string): string => {
    const line = lines.find((l) => l.startsWith(`${key}: `));
    return line ? line.substring(key.length + 2).trim() : "";
  };
  const briefStart = lines.findIndex((l) => l.startsWith("brief: |"));
  const brief = briefStart >= 0
    ? lines.slice(briefStart + 1).map((l) => l.replace(/^  /, "")).join("\n").trim()
    : "";
  const dependsOnRaw = get("dependsOn");
  const dependsOn = dependsOnRaw.replace(/[\[\]]/g, "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    role: get("role"),
    assignedProvider: get("assignedProvider"),
    brief,
    dependsOn,
  };
}

function scanQueue(): { pending: PendingTask[]; claimed: { taskId: string; claimedBy: string; role: string; sessionId: string }[] } {
  const pending: PendingTask[] = [];
  const claimed: { taskId: string; claimedBy: string; role: string; sessionId: string }[] = [];

  if (!existsSync(BUS_ACTIVE)) return { pending, claimed };

  const sessions = readdirSync(BUS_ACTIVE).filter((n) => n.startsWith("sess-"));

  for (const sid of sessions) {
    const tasksDir = join(BUS_ACTIVE, sid, "tasks");
    if (!existsSync(tasksDir)) continue;
    const files = readdirSync(tasksDir);
    const doneIds = new Set(
      files
        .filter((f) => f.startsWith("done-"))
        .map((f) => f.replace("done-", "").replace(".yaml", "")),
    );

    for (const f of files) {
      if (!f.endsWith(".yaml")) continue;
      const path = join(tasksDir, f);
      try {
        const content = readFileSync(path, "utf-8");
        const parsed = parseTaskYaml(content);
        const taskId = f.replace(/^(pending|claimed-[^-]+(?:-[^-]+)*?)-/, "").replace(".yaml", "");

        if (f.startsWith("pending-")) {
          const depsOk = parsed.dependsOn.every((d) => doneIds.has(d));
          pending.push({
            taskId,
            role: parsed.role,
            provider: parsed.assignedProvider,
            sessionId: sid,
            brief: parsed.brief.substring(0, 100),
            depsOk,
          });
        } else if (f.startsWith("claimed-")) {
          const m = f.match(/^claimed-([^-]+(?:-[^-]+)*?)-([a-f0-9]+)\.yaml$/);
          if (m) {
            claimed.push({
              taskId: m[2],
              claimedBy: m[1],
              role: parsed.role,
              sessionId: sid,
            });
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  return { pending, claimed };
}

function renderDashboard(): void {
  const { pending, claimed } = scanQueue();

  // Clear screen
  process.stdout.write("\x1Bc");

  const now = new Date().toLocaleTimeString();
  console.log(chalk.bold.cyan(`╔══════════════════════════════════════════════════════════════════════╗`));
  console.log(chalk.bold.cyan(`║  🟢 JODL BUS DASHBOARD                              ${chalk.gray(now.padStart(15))}  ║`));
  console.log(chalk.bold.cyan(`╚══════════════════════════════════════════════════════════════════════╝`));
  console.log();

  // Group pending by provider
  const byProvider: Record<string, PendingTask[]> = {};
  for (const t of pending) {
    if (!byProvider[t.provider]) byProvider[t.provider] = [];
    byProvider[t.provider].push(t);
  }

  const providers = ["claude-code", "antigravity", "codex"];
  for (const p of providers) {
    const tasks = byProvider[p] ?? [];
    const ready = tasks.filter((t) => t.depsOk);
    const blocked = tasks.filter((t) => !t.depsOk);
    const myClaimed = claimed.filter((c) => c.claimedBy === p);

    let icon = chalk.gray("○");
    let status = chalk.gray("idle");
    if (myClaimed.length > 0) {
      icon = chalk.blue("●");
      status = chalk.blue(`working (${myClaimed.length} claimed)`);
    } else if (ready.length > 0) {
      icon = chalk.yellow("🔔");
      status = chalk.yellow.bold(`WAKE — ${ready.length} task(s) ready`);
    } else if (blocked.length > 0) {
      icon = chalk.gray("⏳");
      status = chalk.gray(`${blocked.length} blocked (waiting on deps)`);
    }

    console.log(`${icon}  ${chalk.bold(p.padEnd(14))} ${status}`);

    for (const t of ready) {
      console.log(`     ${chalk.yellow("▸")} ${chalk.cyan(t.taskId)}  ${t.role}`);
      console.log(`        ${chalk.gray(t.brief.substring(0, 70))}...`);
    }
    for (const c of myClaimed) {
      console.log(`     ${chalk.blue("⚙")} ${chalk.cyan(c.taskId)}  ${c.role} ${chalk.gray("(in progress)")}`);
    }
    for (const t of blocked) {
      console.log(`     ${chalk.gray("◌")} ${chalk.gray(t.taskId)}  ${t.role} ${chalk.gray("(blocked)")}`);
    }
  }

  console.log();
  console.log(chalk.gray(`Watching ${BUS_ACTIVE} — Ctrl+C to exit`));
  console.log(chalk.gray(`Tell the WAKE'd AI: "run jodl"`));
}

let renderTimer: NodeJS.Timeout | null = null;
let lastPendingCount = 0;

function scheduleRender(): void {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    const { pending } = scanQueue();
    const newReady = pending.filter((t) => t.depsOk).length;
    if (newReady > lastPendingCount) {
      // New work appeared — beep
      process.stdout.write("\x07");
    }
    lastPendingCount = newReady;
    renderDashboard();
  }, 200);
}

export function registerWatchCommand(program: Command): void {
  program
    .command("watch")
    .description("Live dashboard — shows which provider has work waiting (run in dedicated terminal)")
    .action(() => {
      if (!existsSync(BUS_ACTIVE)) {
        console.error(chalk.red(`Bus dir not found: ${BUS_ACTIVE}`));
        console.error(chalk.gray("Run: jodl brief \"...\" first"));
        process.exit(1);
      }

      renderDashboard();

      // Watch the active dir recursively
      try {
        watch(BUS_ACTIVE, { recursive: true }, (_event, filename) => {
          if (filename && filename.endsWith(".yaml")) {
            scheduleRender();
          }
        });
      } catch (e) {
        console.error(chalk.red(`Failed to watch ${BUS_ACTIVE}: ${e instanceof Error ? e.message : e}`));
        process.exit(1);
      }

      // Heartbeat refresh every 10s (catches missed events)
      setInterval(scheduleRender, 10000);

      // Keep process alive
      process.stdin.resume();
    });
}
