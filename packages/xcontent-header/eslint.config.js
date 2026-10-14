import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist', 'eslint.config.js'] },

  // typescript-eslint's strictest bundled config, with type information.
  // tsconfig.test.json covers the library code, the tests and the Vitest config;
  // tsconfig.json covers src/runtime.d.ts, which the test config leaves out.
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.test.json', './tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Imports and exports. tsc (with verbatimModuleSyntax) already requires types to
  // be imported and exported with `type`; these rules settle the style it leaves open.
  {
    rules: {
      // One statement per module, for imports and `export ... from` alike. Mixing
      // values and types from one module therefore uses inline `type` markers.
      'no-duplicate-imports': ['error', { includeExports: true }],
      // `import { type A, type B } from 'x'` leaves `import 'x'` in the output; use
      // `import type { A, B } from 'x'` instead.
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },

  // The package's entry points may only export public code, never anything in an
  // `internal/` folder.
  {
    files: ['src/index.ts', 'src/extended.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/internal', '**/internal/**'],
              message: 'Entry points must not export internal code.',
            },
          ],
        },
      ],
    },
  },
);
