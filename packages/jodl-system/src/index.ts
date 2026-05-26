/**
 * @jodl/system — intelligence layer public API
 * Used by agents and CLI tools to query the knowledge graph.
 */

export { search, compose } from "./search.js";
export { getComponent, listComponents } from "./registry.js";
export { getPairings, getConflicts } from "./graph.js";
export { addFeedback, getScore } from "./feedback.js";
