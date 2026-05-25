/**
 * jodl curate <url>
 * Harvests a reference site into jodl-system/sources/
 * Requires firecrawl or playwright to be available.
 * Outputs raw HTML/CSS + _meta.yaml template for manual curation.
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";

const SYSTEM_DIR = resolve(import.meta.dirname, "../../../../packages/jodl-system");
const SOURCES_DIR = join(SYSTEM_DIR, "sources");

export async function curate(url: string, type?: string): Promise<void> {
  const domain = new URL(url).hostname.replace("www.", "");
  const slug = domain.replace(/\./g, "-");
  const outDir = join(SOURCES_DIR, slug);

  console.log(chalk.bold(`\n🌐 Harvesting: ${url}\n`));

  if (existsSync(outDir)) {
    console.log(chalk.yellow(`  Source already exists: sources/${slug}/`));
    console.log("  Add new type subfolder manually or delete to re-harvest.");
    return;
  }

  mkdirSync(outDir, { recursive: true });
  if (type) mkdirSync(join(outDir, type), { recursive: true });

  // Write _meta.yaml template
  const meta = `name: ${domain}
url: ${url}
harvested: ${new Date().toISOString().split("T")[0]}
harvested-by: jodl-cli
brand-tone: []
notable:
  typography: ""
  motion: ""
  layout: ""
  color: ""
quality: staging
patterns-extracted: []
notes: ""
`;
  writeFileSync(join(outDir, "_meta.yaml"), meta);

  console.log(chalk.bold("  Next steps:"));
  console.log(`  1. Open ${url} in browser, inspect Typography/Motion/Layout`);
  console.log(`  2. Edit sources/${slug}/_meta.yaml with your observations`);
  console.log(`  3. Create synthesis files in packages/jodl-system/patterns/${type ?? "<type>"}/<name>/`);
  console.log(`  4. Run: pnpm jodl embed`);
  console.log(chalk.green(`\n✓ Source template created: sources/${slug}/`));

  // TODO Phase 2: Auto-scrape with playwright or firecrawl
  // const { chromium } = await import("playwright");
  // ...
}
