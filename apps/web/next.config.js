/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@app/shared", "@app/ui"],
  experimental: {
    typedRoutes: false,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
