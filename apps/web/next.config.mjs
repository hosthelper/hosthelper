/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hosthelper/shared', '@hosthelper/ui'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
