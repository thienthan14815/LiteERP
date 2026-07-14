/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@app/shared", "@app/ui"],
  output: "export",
  images: { unoptimized: true },
  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;
