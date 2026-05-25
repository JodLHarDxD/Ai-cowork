import { defineConfig } from "tsup";
export default defineConfig({
  entry: {
    index: "src/index.ts",
    gsap: "src/gsap.ts",
    lenis: "src/lenis.ts",
    "page-transitions": "src/page-transitions.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "gsap", "lenis"],
  treeshake: true,
});
