import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  webpack(config) {
    config.resolve ??= {};
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    return config;
  },
};

export default nextConfig;
