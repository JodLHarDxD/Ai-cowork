import { defineConfig } from "tsup";
export default defineConfig({
  entry: {
    index: "src/index.ts",
    ecommerce: "src/ecommerce.ts",
    layout: "src/layout.ts",
    editorial: "src/editorial.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "gsap", "lenis"],
  treeshake: true,
});
