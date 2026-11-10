import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/advanced.ts", "src/types.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // Shared chunk so index.js and advanced.js use ONE copy of errors.ts:
  // `instanceof` and isTxIndexerError hold across entry points. The package
  // ships ESM only (see package.json "exports"), which tsup splits natively.
  splitting: true,
  // Don't bundle peer dependencies
  external: ["@solana/kit", "zod"],
  // Bundle all workspace dependencies into the output
  noExternal: [/^@tx-indexer/],
});
