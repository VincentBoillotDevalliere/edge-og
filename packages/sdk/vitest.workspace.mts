import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      environment: 'node',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'json'],
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
]);
