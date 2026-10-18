import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  experimental: {
    serverActions: {
      // Study OCR sends a downscaled card photo as base64 to the extraction action.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
