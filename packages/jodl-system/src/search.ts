/**
 * Semantic search over component registry.
 * Phase 1: keyword + tag search (no embeddings needed yet).
 * Phase 2: replace with sqlite-vss vector similarity when corpus > 50 patterns.
 */

import { listComponents } from "./registry.js";
import { getBestPairingsForContext } from "./graph.js";

export type SearchResult = {
  name: string;
  score: number;
  matchedTags: string[];
  quality: string;
  package: string;
  pairings: string[];
};

/**
 * Search the component registry by free text query.
 * Extracts keywords, matches against tags + context + rationale.
 * Returns top N results sorted by relevance.
 */
export function search(query: string, limit = 5): SearchResult[] {
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2);

  const components = listComponents();
  const results: SearchResult[] = [];

  for (const [name, component] of components) {
    let score = 0;
    const matchedTags: string[] = [];

    for (const keyword of keywords) {
      // Tag match (high weight)
      const tagHits = component.tags.filter(t => t.includes(keyword) || keyword.includes(t));
      score += tagHits.length * 3;
      matchedTags.push(...tagHits);

      // Name match (medium weight)
      if (name.toLowerCase().includes(keyword)) score += 2;

      // Quality bonus
      if (component.quality === "proven") score += 1;
      if (component.quality === "staging") score += 0.5;

      // Use count bonus (social proof)
      score += Math.min(component.uses * 0.2, 1);
    }

    if (score > 0) {
      results.push({
        name,
        score,
        matchedTags: [...new Set(matchedTags)],
        quality: component.quality,
        package: component.package,
        pairings: component.pairsWith ?? [],
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Compose a page by querying both registry and graph.
 * Returns suggested component set + optimal pairings.
 */
export function compose(brief: {
  context: string;
  tone: string;
  components?: string[];
}): { components: SearchResult[]; pairings: ReturnType<typeof getBestPairingsForContext> } {
  const contextPairings = getBestPairingsForContext(brief.context);
  const components = search(`${brief.context} ${brief.tone}`, 8);

  return { components, pairings: contextPairings };
}
