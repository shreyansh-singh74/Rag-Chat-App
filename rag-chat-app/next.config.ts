import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Webpack config for non-Turbopack builds
  webpack: (config, { isServer }) => {
    // Ensure pdf-parse and related modules are only used on the server
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Exclude pdf-parse from client-side bundling
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push('pdf-parse');
    }

    return config;
  },
  // Turbopack config (Next.js 16 default)
  turbopack: {
    // Turbopack handles server/client separation automatically
    // pdf-parse will only be used in server components/API routes
  },
};

export default nextConfig;
