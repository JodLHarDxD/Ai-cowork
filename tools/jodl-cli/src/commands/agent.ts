/**
 * jodl agent — call domain agents via LLM API
 *
 * Usage:
 *   jodl agent run uiux-master --brief "luxury fashion hero section"
 *   jodl agent run frontend-master --brief "implement the CartDrawer component"
 *   jodl agent list
 *
 * Agent chain (standard flow):
 *   uiux-master → motion-master → typography-master → frontend-master
 *
 * Requires: ANTHROPIC_API_KEY env var
 * Optional: JODL_MODEL env var (default: claude-sonnet-4-6)
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";
import chalk from "chalk";

// ─── paths ───────────────────────────────────────────────────────────────────

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../../..");
const AGENTS_DIR = join(WORKSPACE_ROOT, "packages/jodl-system/agents");
const REGISTRY_PATH = join(WORKSPACE_ROOT, "packages/jodl-system/registry/components.json");
const PAIRINGS_PATH = join(WORKSPACE_ROOT, "packages/jodl-system/graph/pairings.json");

// ─── helpers ─────────────────────────────────────────────────────────────────

function loadAgentSystem(agentName: string): string {
  const agentDir = join(AGENTS_DIR, agentName);

  if (!existsSync(agentDir)) {
    throw new Error(`Agent "${agentName}" not found in ${AGENTS_DIR}`);
  }

  const systemPromptPath = join(agentDir, "system-prompt.md");
  const knowledgePath = join(agentDir, "knowledge-pack.md");

  if (!existsSync(systemPromptPath)) {
    throw new Error(`Agent "${agentName}" has no system-prompt.md`);
  }

  let system = readFileSync(systemPromptPath, "utf-8");

  // Append knowledge pack if present
  if (existsSync(knowledgePath)) {
    const knowledge = readFileSync(knowledgePath, "utf-8");
    system += `\n\n---\n\n## Knowledge Pack\n\n${knowledge}`;
  }

  return system;
}

function loadRegistryContext(): string {
  try {
    const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
    const pairings = JSON.parse(readFileSync(PAIRINGS_PATH, "utf-8"));

    return `## Component Registry (${registry.length} components)\n\`\`\`json\n${JSON.stringify(registry, null, 2)}\n\`\`\`\n\n## Graph Pairings\n\`\`\`json\n${JSON.stringify(pairings, null, 2)}\n\`\`\``;
  } catch {
    return "## Registry\n(unavailable — run `jodl embed` to rebuild)";
  }
}

function listAgents(): string[] {
  if (!existsSync(AGENTS_DIR)) return [];
  return readdirSync(AGENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

// ─── run agent ───────────────────────────────────────────────────────────────

export async function runAgent(agentName: string, brief: string, opts: { stream?: boolean; model?: string }) {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    console.error(chalk.red("Error: ANTHROPIC_API_KEY not set"));
    console.error("  Set it: $env:ANTHROPIC_API_KEY = 'sk-ant-...'");
    process.exit(1);
  }

  const model = opts.model ?? process.env["JODL_MODEL"] ?? "claude-sonnet-4-6";
  const client = new Anthropic({ apiKey });

  let systemPrompt: string;
  try {
    systemPrompt = loadAgentSystem(agentName);
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }

  const registryContext = loadRegistryContext();

  // Inject registry as additional context block
  const fullSystem = `${systemPrompt}\n\n---\n\n${registryContext}`;

  console.log(chalk.bold(`\n🤖 ${agentName}`));
  console.log(chalk.gray(`   model: ${model}`));
  console.log(chalk.gray(`   brief: ${brief}\n`));
  console.log(chalk.bold("─".repeat(60)));

  if (opts.stream !== false) {
    // Streaming mode (default)
    const stream = client.messages.stream({
      model,
      max_tokens: 4096,
      system: fullSystem,
      messages: [{ role: "user", content: brief }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        process.stdout.write(event.delta.text);
      }
    }
    console.log("\n" + chalk.bold("─".repeat(60)));

    const usage = (await stream.finalMessage()).usage;
    console.log(chalk.gray(`\nTokens: ${usage.input_tokens} in / ${usage.output_tokens} out`));

  } else {
    // Non-streaming
    const msg = await client.messages.create({
      model,
      max_tokens: 4096,
      system: fullSystem,
      messages: [{ role: "user", content: brief }],
    });

    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    console.log(text);
    console.log("\n" + chalk.bold("─".repeat(60)));
    console.log(chalk.gray(`\nTokens: ${msg.usage.input_tokens} in / ${msg.usage.output_tokens} out`));
  }
}

// ─── register commands ────────────────────────────────────────────────────────

import type { Command } from "commander";

export function registerAgentCommands(program: Command): void {
  const agentCmd = program
    .command("agent")
    .description("Call domain agents via LLM API");

  agentCmd
    .command("list")
    .description("List available agents")
    .action(() => {
      const agents = listAgents();
      if (agents.length === 0) {
        console.log(chalk.yellow("No agents found in jodl-system/agents/"));
        return;
      }
      console.log(chalk.bold("\n🤖 Available agents:\n"));
      for (const a of agents) {
        const hasKnowledge = existsSync(join(AGENTS_DIR, a, "knowledge-pack.md"));
        console.log(`  ${chalk.cyan(a)}${hasKnowledge ? chalk.gray(" + knowledge-pack") : ""}`);
      }
      console.log();
      console.log(chalk.gray("Standard chain: uiux-master → motion-master → typography-master → frontend-master"));
      console.log(chalk.gray("Run: jodl agent run <name> --brief \"your design brief\""));
      console.log();
    });

  agentCmd
    .command("run <name>")
    .description("Run an agent with a brief")
    .requiredOption("--brief <text>", "Design or implementation brief")
    .option("--model <id>", "Override model (default: claude-sonnet-4-6)")
    .option("--no-stream", "Disable streaming output")
    .action(async (name: string, opts: { brief: string; model?: string; stream?: boolean }) => {
      await runAgent(name, opts.brief, {
        stream: opts.stream,
        model: opts.model,
      });
    });
}
