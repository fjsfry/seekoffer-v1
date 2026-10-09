import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const requestedBuildTarget = process.env.SEEKOFFER_BUILD_TARGET;
const requestedPublicSurface = process.env.NEXT_PUBLIC_SEEKOFFER_SURFACE;

if (requestedBuildTarget && requestedBuildTarget !== 'web' && requestedBuildTarget !== 'desktop') {
  throw new Error(`SEEKOFFER_BUILD_TARGET 只能是 web 或 desktop，当前为 ${requestedBuildTarget}。`);
}
if (
  requestedBuildTarget &&
  requestedPublicSurface &&
  requestedPublicSurface !== requestedBuildTarget
) {
  throw new Error(
    `构建目标 ${requestedBuildTarget} 与公开表面 ${requestedPublicSurface} 不一致。`
  );
}

const isDesktopSurface = requestedBuildTarget
  ? requestedBuildTarget === 'desktop'
  : requestedPublicSurface === 'desktop';
const isDesktopDevelopment = isDesktopSurface && process.env.NODE_ENV === 'development';
const desktopDistDir = isDesktopDevelopment ? '.next-desktop-dev' : '.next-desktop';
const buildSurfaceRelativeModule = `./app/${
  isDesktopSurface ? 'build-surface.desktop.tsx' : 'build-surface.tsx'
}`;
const buildSurfaceModule = path.join(
  projectRoot,
  'app',
  isDesktopSurface ? 'build-surface.desktop.tsx' : 'build-surface.tsx'
);
const packageMetadata = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: isDesktopSurface ? desktopDistDir : '.next-web',
  output: 'export',
  ...(isDesktopSurface ? { devIndicators: false } : {}),
  turbopack: {
    resolveAlias: {
      'seekoffer-build-surface': buildSurfaceRelativeModule
    }
  },
  webpack(config) {
    config.resolve.alias['seekoffer-build-surface'] = buildSurfaceModule;
    return config;
  },
  env: {
    NEXT_PUBLIC_SEEKOFFER_APP_VERSION: packageMetadata.version
  },
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
