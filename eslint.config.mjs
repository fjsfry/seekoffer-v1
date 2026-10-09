import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory });

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      '.next-web/**',
      '.next-desktop/**',
      '.next-desktop-dev/**',
      '.wechat-codex/**',
      'artifacts/**',
      'node_modules/**',
      'node_modules_corrupt_*/**',
      'out/**',
      'build/**',
      'src-tauri/target/**',
      'hosting-dist/**',
      'supabase/**',
      'next-env.d.ts'
    ]
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript')
];

export default eslintConfig;
