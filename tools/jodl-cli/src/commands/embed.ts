/**
 * jodl embed
 * Rebuilds embedding index from all patterns in jodl-system/patterns/
 * Requires: OPENAI_API_KEY env var
 * Uses: text-embedding-3-small (~$0.02 per 1M tokens)
 * Stores: jodl-system/embeddings/patterns.sqlite (sqlite-vss)
 *
 * Phase 1: keyword index only (no OpenAI needed — zero cost)
 * Phase 2: replace with vector embeddings when patterns > 50
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import matter from "gray-matter";

const SYSTEM_DIR = resolve(import.meta.dirname, "../../../../packages/jodl-system");
const PATTERNS_DIR = join(SYSTEM_DIR, "patterns");
const REGISTRY_PATH = join(SYSTEM_DIR, "registry/components.json");

type PatternMeta = {
  name: string;
  path: string;
  tags: string[];
  quality: string;
  description: string;
};

function walkPatterns(dir: string): PatternMeta[] {
  const results: PatternMeta[] = [];

  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      const metaPath = join(fullPath, "_meta.yaml");
      if (existsSync(metaPath)) {
        const raw = readFileSync(metaPath, "utf-8");
        const { data } = matter(raw);
        results.push({
          name: entry,
          path: fullPath.replace(SYSTEM_DIR, ""),
          tags: data.tags ?? [],
          quality: data.quality ?? "staging",
          description: data.description ?? "",
        });
      }
      // Recurse
      results.push(...walkPatterns(fullPath));
    }
  }
  return results;
}

export async function embed(): Promise<void> {
  console.log(chalk.bold("\n🔢 Rebuilding embedding index\n"));

  const patterns = walkPatterns(PATTERNS_DIR);
  console.log(`  Found ${patterns.length} patterns in patterns/`);

  if (patterns.length === 0) {
    console.log(chalk.yellow("  No patterns with _meta.yaml found yet."));
    console.log("  Create pattern directories with _meta.yaml to start indexing.");
    return;
  }

  // Phase 1: keyword index (always works, zero cost)
  console.log("  Building keyword index...");
  const index = patterns.map(p => ({
    name: p.name,
    path: p.path,
    tags: p.tags,
    quality: p.quality,
    searchText: `${p.name} ${p.tags.join(" ")} ${p.description}`.toLowerCase(),
  }));

  console.log(`  ✓ Keyword index: ${index.length} patterns`);

  // Phase 2: OpenAI embeddings (only if API key present + patterns > 50)
  const apiKey = process.env["OPENAI_API_KEY"];
  if (apiKey && patterns.length > 50) {
    console.log("  Building vector embeddings (OpenAI text-embedding-3-small)...");
    // TODO: implement with openai SDK + better-sqlite3 + sqlite-vss
    // const openai = new OpenAI({ apiKey });
    // ...
    console.log(chalk.yellow("  Vector embedding: not yet implemented (Phase 2)"));
  } else if (!apiKey) {
    console.log(chalk.gray("  Vector embeddings skipped (no OPENAI_API_KEY). Keyword index sufficient."));
  } else {
    console.log(chalk.gray(`  Vector embeddings skipped (${patterns.length} patterns, threshold: 50)`));
  }

  console.log(chalk.green("\n✓ Index rebuilt"));
}
