/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hosthelper/shared'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
