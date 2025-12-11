/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "tx-indexer",
    "@tx-indexer/core",
    "@tx-indexer/solana",
    "@tx-indexer/classification",
  ],
};

export default nextConfig;
