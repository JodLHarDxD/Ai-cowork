import { defineConfig } from "tsup";
export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  dts: false,
  clean: true,
  external: ["openai", "better-sqlite3"],
  treeshake: true,
  banner: { js: "#!/usr/bin/env node" },
});
