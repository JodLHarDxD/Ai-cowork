import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    search: "src/search.ts",
    feedback: "src/feedback.ts",
    registry: "src/registry.ts",
    graph: "src/graph.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
