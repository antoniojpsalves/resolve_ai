import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import eslintConfigPrettier from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  eslintConfigPrettier,
  {
    rules: {
      // Convenção do projeto: um parâmetro não usado prefixado com `_` é
      // intencional (ex.: mantém a assinatura uniforme de uma família de
      // funções) e não deve gerar warning — dispensa `eslint-disable` local.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts'],
  },
];

export default eslintConfig;
