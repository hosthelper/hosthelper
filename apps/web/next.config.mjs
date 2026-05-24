/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hosthelper/shared', '@hosthelper/ui'],
  experimental: {
    typedRoutes: true,
  },
  // STATIC_EXPORT=1 일 때 정적 export(out/) 생성 — Netlify 등 정적 호스팅 배포용.
  ...(process.env.STATIC_EXPORT === '1' ? { output: 'export', images: { unoptimized: true } } : {}),
};

export default nextConfig;
