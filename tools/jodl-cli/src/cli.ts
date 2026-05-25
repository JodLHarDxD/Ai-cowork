#!/usr/bin/env node
/**
 * jodl-cli — command line interface for jodl-system
 *
 * Commands:
 *   jodl search <query>        — semantic search over component registry
 *   jodl curate <url>          — harvest a reference site into sources/
 *   jodl embed                 — rebuild embedding index
 *   jodl vendor <app> <dest>   — extract app as standalone (detach @jodl/* deps)
 *   jodl feedback <id> <score> — record component rating
 *   jodl compose <brief>       — compose a page from registry + graph
 *   jodl list [filter]         — list components by quality/tags
 */

import { Command } from "commander";
import { search, compose, addFeedback, listComponents } from "@jodl/system";
import chalk from "chalk";

const program = new Command();

program
  .name("jodl")
  .description("jodl-workspace intelligence CLI")
  .version("0.0.1");

// --- SEARCH ---
program
  .command("search <query>")
  .description("Semantic search over component registry")
  .option("-n, --limit <number>", "max results", "5")
  .action((query: string, opts: { limit: string }) => {
    const results = search(query, parseInt(opts.limit));

    if (results.length === 0) {
      console.log(chalk.yellow("No matches found."));
      return;
    }

    console.log(chalk.bold(`\n🔍 Search: "${query}"\n`));
    for (const r of results) {
      const qualityColor = r.quality === "proven" ? chalk.green : r.quality === "staging" ? chalk.yellow : chalk.gray;
      console.log(`${chalk.bold(r.name)} ${qualityColor(`[${r.quality}]`)} — ${r.package}`);
      console.log(`  Score: ${r.score.toFixed(1)}  Tags: ${r.matchedTags.join(", ")}`);
      if (r.pairings.length) console.log(`  Pairs with: ${r.pairings.join(", ")}`);
      console.log();
    }
  });

// --- LIST ---
program
  .command("list")
  .description("List components in registry")
  .option("-q, --quality <level>", "filter by quality: proven|staging|experimental")
  .option("-t, --tags <tags>", "filter by tags (comma-separated)")
  .action((opts: { quality?: string; tags?: string }) => {
    const components = listComponents({
      quality: opts.quality as "proven" | "staging" | "experimental" | undefined,
      tags: opts.tags?.split(","),
    });

    console.log(chalk.bold(`\n📦 Components (${components.length})\n`));
    for (const [name, c] of components) {
      const q = c.quality === "proven" ? chalk.green("✓") : c.quality === "staging" ? chalk.yellow("~") : chalk.gray("?");
      console.log(`${q} ${chalk.bold(name)} — ${c.package} — [${c.tags.slice(0, 3).join(", ")}]`);
    }
    console.log();
  });

// --- COMPOSE ---
program
  .command("compose <brief>")
  .description("Compose a page from registry and graph")
  .option("-c, --context <context>", "brand context", "luxury-fashion")
  .action((brief: string, opts: { context: string }) => {
    const result = compose({ context: opts.context, tone: brief });

    console.log(chalk.bold(`\n⚒ Composition for: "${brief}" (${opts.context})\n`));

    console.log(chalk.bold("Components:"));
    for (const c of result.components) {
      console.log(`  ${c.name} [${c.quality}] — ${c.package}`);
    }

    if (result.pairings.length) {
      console.log(chalk.bold("\nBest pairings in context:"));
      for (const p of result.pairings) {
        console.log(`  ${p.id}: ${p.components.join(" + ")}`);
        console.log(`  → ${p.rationale}`);
      }
    }
    console.log();
  });

// --- FEEDBACK ---
program
  .command("feedback <componentId> <rating>")
  .description("Record component rating (1-5)")
  .option("-o, --outcome <outcome>", "kept|edited|rejected", "kept")
  .action((componentId: string, rating: string, opts: { outcome: string }) => {
    const r = parseFloat(rating);
    if (r < 1 || r > 5) {
      console.error(chalk.red("Rating must be 1-5"));
      process.exit(1);
    }
    addFeedback(componentId, r, opts.outcome as "kept" | "edited" | "rejected");
    console.log(chalk.green(`✓ Feedback recorded: ${componentId} → ${r}/5 (${opts.outcome})`));
  });

// --- VENDOR ---
program
  .command("vendor <app> <dest>")
  .description("Extract app as standalone — detaches @jodl/* workspace deps")
  .action(async (app: string, dest: string) => {
    const { vendor } = await import("./commands/vendor.js");
    await vendor(app, dest);
  });

// --- CURATE ---
program
  .command("curate <url>")
  .description("Harvest a reference site into sources/")
  .option("-t, --type <type>", "pattern type: typography|motion|layout|ecommerce|editorial")
  .action(async (url: string, opts: { type?: string }) => {
    const { curate } = await import("./commands/curate.js");
    await curate(url, opts.type);
  });

// --- EMBED ---
program
  .command("embed")
  .description("Rebuild embedding index (requires OPENAI_API_KEY)")
  .action(async () => {
    const { embed } = await import("./commands/embed.js");
    await embed();
  });

program.parse();
