import { defineConfig } from 'vitest/config';

// Standalone config (does not extend vite.config.ts) so unit tests run without
// the Tailwind plugin or WASM/cross-origin-isolation headers. The field tests
// exercise pure TypeScript, mirroring the Rust core in src/lib.rs.
export default defineConfig({
  test: {
    include: ['src-ts/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src-ts/field.ts', 'src-ts/format.ts'],
      reporter: ['text', 'html'],
    },
  },
});
