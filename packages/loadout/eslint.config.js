import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // public/ holds static files served as they are, such as the service worker.
  { ignores: ['dist', 'public', 'eslint.config.js'] },

  // typescript-eslint's strictest bundled config, with type information.
  // tsconfig.test.json covers the app's code, the tests and the build configs.
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Imports and exports, as in the xcontent-* packages. tsc (with
  // verbatimModuleSyntax) already requires types to be imported with `type`; these
  // rules settle the style it leaves open.
  {
    rules: {
      // One statement per module, for imports and `export ... from` alike.
      'no-duplicate-imports': ['error', { includeExports: true }],
      // `import { type A } from 'x'` leaves `import 'x'` in the output; use `import type`.
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },

  // Components and pages are views over the store. File and header work goes
  // through src/lib/ and the store, never straight to the libraries.
  {
    files: ['src/components/**', 'src/pages/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['xcontent-fs-web', 'xcontent-fs-web/*', 'xcontent-header', 'xcontent-header/*'],
              message: 'Components and pages use src/lib/ and the store, not the libraries.',
            },
          ],
        },
      ],
    },
  },

  // src/lib/ and the store run in Node tests, without a DOM, so they never import
  // Lit, components or pages.
  {
    files: ['src/lib/**', 'src/app/store.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['lit', 'lit/*', '**/components/**', '**/pages/**'],
              message: 'src/lib/ and the store must run in Node: no Lit, components or pages.',
            },
          ],
        },
      ],
    },
  },
);
