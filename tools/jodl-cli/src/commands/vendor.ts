/**
 * jodl vendor <app> <dest>
 * Extracts an app from the monorepo as a standalone deployable/sellable repo.
 * Vendors all @jodl/* workspace packages inline.
 */

import { readFileSync, writeFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../../..");
const APPS_DIR = join(WORKSPACE_ROOT, "apps");
const PACKAGES_DIR = join(WORKSPACE_ROOT, "packages");

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
};

export async function vendor(appName: string, destPath: string): Promise<void> {
  const appDir = join(APPS_DIR, appName);
  const dest = resolve(destPath);

  if (!existsSync(appDir)) {
    console.error(chalk.red(`App not found: ${appDir}`));
    process.exit(1);
  }

  console.log(chalk.bold(`\n📦 Vendoring ${appName} → ${dest}\n`));

  // 1. Copy app
  console.log("  Copying app...");
  mkdirSync(dest, { recursive: true });
  cpSync(appDir, dest, { recursive: true });

  // 2. Find @jodl/* deps
  const pkgPath = join(dest, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJson;
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const jodlDeps = Object.keys(allDeps).filter(d => d.startsWith("@jodl/"));

  if (jodlDeps.length === 0) {
    console.log(chalk.yellow("  No @jodl/* deps found. App may already be standalone."));
    return;
  }

  console.log(`  Found workspace deps: ${jodlDeps.join(", ")}`);

  // 3. Copy each @jodl/* package into dest/src/vendor/
  const vendorDir = join(dest, "src", "vendor");
  mkdirSync(vendorDir, { recursive: true });

  for (const dep of jodlDeps) {
    const pkgName = dep.replace("@jodl/", "jodl-");
    const pkgSrc = join(PACKAGES_DIR, pkgName, "src");

    if (!existsSync(pkgSrc)) {
      console.warn(chalk.yellow(`  Warning: src not found for ${dep}, skipping`));
      continue;
    }

    const vendorPkgDir = join(vendorDir, pkgName);
    cpSync(pkgSrc, vendorPkgDir, { recursive: true });
    console.log(`  ✓ Vendored ${dep} → src/vendor/${pkgName}/`);
  }

  // 4. Remove workspace deps from package.json
  for (const dep of jodlDeps) {
    if (pkg.dependencies?.[dep]) delete pkg.dependencies[dep];
    if (pkg.devDependencies?.[dep]) delete pkg.devDependencies?.[dep];
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  // 5. Print import rewrite reminder
  console.log(chalk.bold("\n⚠️  Manual step required:"));
  console.log("  Rewrite imports in src/ from:");
  for (const dep of jodlDeps) {
    const pkgName = dep.replace("@jodl/", "jodl-");
    console.log(`    import { ... } from "${dep}"  →  import { ... } from "./vendor/${pkgName}/index.js"`);
  }
  console.log("\n  Or add path aliases to vite.config.ts for cleaner imports.");
  console.log(chalk.green(`\n✓ ${appName} vendored to ${dest}`));
  console.log(`  Next: cd ${dest} && git init && git add -A && git commit -m "initial"`);
}
