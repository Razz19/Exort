import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteParser from 'svelte-eslint-parser';
import tseslint from 'typescript-eslint';

const nodeGlobals = {
  ...globals.node
};

const mixedGlobals = {
  ...globals.browser,
  ...globals.node
};

export default [
  {
    ignores: ['node_modules/**', 'out/**', 'dist/**', '.turbo/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['src/**/*.{ts,js}', 'electron.vite.config.ts', 'svelte.config.js'],
    languageOptions: {
      globals: mixedGlobals
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },
  {
    files: ['src/**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte']
      },
      globals: mixedGlobals
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'svelte/no-at-html-tags': 'off',
      'svelte/valid-compile': 'off'
    }
  },
  {
    files: ['electron.vite.config.ts', 'svelte.config.js', 'postcss.config.cjs', 'tailwind.config.cjs'],
    languageOptions: {
      globals: nodeGlobals
    }
  },
  {
    files: ['postcss.config.cjs', 'tailwind.config.cjs'],
    languageOptions: {
      sourceType: 'commonjs'
    },
    rules: {
      'no-undef': 'off'
    }
  }
];
