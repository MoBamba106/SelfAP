import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
      // `server-only` throws outside a React Server Component context.
      'server-only': resolve(root, 'tests/stubs/server-only.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    // Without a Supabase URL the data layer selects the in-memory demo store,
    // which is what the integration tests exercise.
    env: { NEXT_PUBLIC_DEMO: '1' },
  },
});
