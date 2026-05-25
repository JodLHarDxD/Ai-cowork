import { defineConfig } from "tsup";
export default defineConfig({
  entry: {
    index: "src/index.ts",
    reveal: "src/reveal.ts",
    highlight: "src/highlight.ts",
    pairings: "src/pairings.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "gsap"],
  treeshake: true,
});
