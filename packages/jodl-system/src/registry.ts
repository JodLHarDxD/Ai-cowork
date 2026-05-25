/**
 * Registry queries — typed access to registry/components.json
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const registryPath = join(__dirname, "../registry/components.json");

type ComponentEntry = {
  package: string;
  export: string;
  status: string;
  tags: string[];
  quality: "experimental" | "staging" | "proven";
  score: number | null;
  uses: number;
  usedIn: string[];
  registrySlug: string;
  pairsWith: string[];
  [key: string]: unknown;
};

type Registry = {
  components: Record<string, ComponentEntry>;
};

function loadRegistry(): Registry {
  const raw = readFileSync(registryPath, "utf-8");
  return JSON.parse(raw) as Registry;
}

export function getComponent(name: string): ComponentEntry | undefined {
  return loadRegistry().components[name];
}

export function listComponents(filter?: {
  tags?: string[];
  quality?: ComponentEntry["quality"];
  context?: string;
}): Array<[string, ComponentEntry]> {
  const { components } = loadRegistry();
  let entries = Object.entries(components);

  if (filter?.quality) {
    entries = entries.filter(([, c]) => c.quality === filter.quality);
  }
  if (filter?.tags?.length) {
    entries = entries.filter(([, c]) =>
      filter.tags!.some(t => c.tags.includes(t))
    );
  }

  return entries;
}
