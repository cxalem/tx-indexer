import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    RPC_URL: process.env.RPC_URL,
  },
};

export default nextConfig;
