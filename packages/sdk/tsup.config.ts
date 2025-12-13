import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts', 'src/types.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  // Don't bundle peer dependencies
  external: ['@solana/kit', 'zod'],
  // Bundle all workspace dependencies into the output
  noExternal: [/^@tx-indexer/],
});

