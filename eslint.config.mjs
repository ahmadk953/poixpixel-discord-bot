import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts}'],
  },

  {
    ignores: ['target/**', 'node_modules/**', 'dist/**', '**/*.d.ts'],
  },

  js.configs.recommended,

  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,

  eslintConfigPrettier,

  {
    files: ['**/*.ts'],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        ...globals.es2024,
      },
    },

    rules: {
      curly: ['error', 'multi-line', 'consistent'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'max-nested-callbacks': ['error', { max: 4 }],
      'no-console': 'error',
      'no-inline-comments': 'error',
      'no-lonely-if': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      quotes: ['warn', 'single'],
      yoda: 'error',

      'prefer-arrow-callback': 'warn',
      'prefer-template': 'warn',
      'object-shorthand': ['warn', 'always'],
      'prefer-destructuring': [
        'warn',
        {
          array: false,
          object: true,
        },
      ],

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',

      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': [
        'error',
        {
          allow: ['err', 'resolve', 'reject'],
        },
      ],

      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',

      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': 'error',

      'no-empty-function': 'off',
      '@typescript-eslint/no-empty-function': [
        'error',
        {
          allow: ['arrowFunctions'],
        },
      ],

      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
    },
  },

  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
]);
