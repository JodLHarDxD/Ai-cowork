/**
 * Feedback loop — log outputs, record ratings, update scores.
 * Self-improvement input: good ratings reinforce, bad ratings flag.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const feedbackPath = join(__dirname, "../graph/feedback.json");

type FeedbackData = {
  scores: Record<string, {
    uses: number;
    ratings: number[];
    avg: number;
    kept: number;
    edited: number;
    rejected: number;
  }>;
  deprecated: string[];
};

function load(): FeedbackData {
  const raw = readFileSync(feedbackPath, "utf-8");
  return JSON.parse(raw) as FeedbackData;
}

function save(data: FeedbackData): void {
  writeFileSync(feedbackPath, JSON.stringify(data, null, 2));
}

export function addFeedback(
  componentId: string,
  rating: number,
  outcome: "kept" | "edited" | "rejected"
): void {
  const data = load();

  if (!data.scores[componentId]) {
    data.scores[componentId] = { uses: 0, ratings: [], avg: 0, kept: 0, edited: 0, rejected: 0 };
  }

  const entry = data.scores[componentId];
  if (!entry) return;

  entry.uses += 1;
  entry.ratings.push(rating);
  entry.avg = entry.ratings.reduce((a, b) => a + b, 0) / entry.ratings.length;
  entry[outcome] += 1;

  // Auto-deprecate if avg < 2 after 3+ uses
  if (entry.uses >= 3 && entry.avg < 2 && !data.deprecated.includes(componentId)) {
    data.deprecated.push(componentId);
    console.warn(`[jodl-system] Auto-deprecated: ${componentId} (avg: ${entry.avg.toFixed(1)})`);
  }

  save(data);
}

export function getScore(componentId: string): number | null {
  const data = load();
  return data.scores[componentId]?.avg ?? null;
}

export function getDeprecated(): string[] {
  return load().deprecated;
}
