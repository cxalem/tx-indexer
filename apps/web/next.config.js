/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    RPC_URL: process.env.RPC_URL,
  },
  transpilePackages: [
    "tx-indexer",
    "@tx-indexer/core",
    "@tx-indexer/solana",
    "@tx-indexer/classification",
  ],
};

export default nextConfig;
