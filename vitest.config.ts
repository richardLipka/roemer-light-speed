import { defineConfig } from 'vitest/config';

/**
 * Everything asserted here is pure computation — light time, shadow geometry,
 * eclipse times, the two routes to c, number formatting and the locale key sets.
 * None of it touches the DOM, so a node environment covers the suite.
 *
 * `physics/` is the layer that matters most: CLAUDE.md §12 lists the assertions
 * the project's claims rest on, and they nearly all live there.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
