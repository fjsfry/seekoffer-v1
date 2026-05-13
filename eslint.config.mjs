import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      '.next-web/**',
      'node_modules/**',
      'node_modules_corrupt_*/**',
      'out/**',
      'build/**',
      'hosting-dist/**',
      'supabase/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default eslintConfig;
