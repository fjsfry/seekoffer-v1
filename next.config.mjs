import { fileURLToPath } from 'node:url';
/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  outputFileTracingIncludes: {'/*':['./data/recovery-public/**/*.json']},
  distDir: process.env.SEEKOFFER_EMERGENCY_BUILD === 'true' ? '.next-emergency' : '.next-web',
  experimental: {
    webpackBuildWorker: false,
    workerThreads: false
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**'
      }
    ]
  },
  trailingSlash: true
};

export default nextConfig;
