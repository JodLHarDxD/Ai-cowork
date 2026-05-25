/**
 * Graph queries — pairings + conflicts
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const graphDir = join(__dirname, "../graph");

type Pairing = {
  id: string;
  components: string[];
  context: string[];
  score: number | null;
  rationale: string;
  quality: string;
};

type Conflict = {
  id: string;
  components: string[];
  reason: string;
  quality: string;
};

type PairingsFile = {
  pairings: Pairing[];
  conflicts: Conflict[];
};

function loadPairings(): PairingsFile {
  const raw = readFileSync(join(graphDir, "pairings.json"), "utf-8");
  return JSON.parse(raw) as PairingsFile;
}

export function getPairings(componentName?: string): Pairing[] {
  const { pairings } = loadPairings();
  if (!componentName) return pairings;
  return pairings.filter(p => p.components.includes(componentName));
}

export function getConflicts(componentName?: string): Conflict[] {
  const { conflicts } = loadPairings();
  if (!componentName) return conflicts;
  return conflicts.filter(c => c.components.includes(componentName));
}

export function getBestPairingsForContext(context: string): Pairing[] {
  const { pairings } = loadPairings();
  return pairings
    .filter(p => p.context.includes(context))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
