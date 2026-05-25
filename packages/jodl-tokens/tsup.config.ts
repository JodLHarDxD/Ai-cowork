import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    colors: "src/colors.ts",
    typography: "src/typography.ts",
    spacing: "src/spacing.ts",
    motion: "src/motion.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
