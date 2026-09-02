/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: '.next-web',
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
