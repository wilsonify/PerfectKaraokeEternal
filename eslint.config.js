// @ts-check

import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'

export default defineConfig(
  eslint.configs.recommended,
  stylistic.configs.recommended,
  {
    rules: {
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
      '@stylistic/space-before-function-paren': ['error', 'always'],
    },
  },
  {
    files: ['js/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['*.js', 'test/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    ignores: ['node_modules/**'],
  },
)
