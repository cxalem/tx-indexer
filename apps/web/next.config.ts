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
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.helius-rpc.com",
      },
      {
        protocol: "https",
        hostname: "**.arweave.net",
      },
      {
        protocol: "https",
        hostname: "arweave.net",
      },
      {
        protocol: "https",
        hostname: "**.ipfs.io",
      },
      {
        protocol: "https",
        hostname: "ipfs.io",
      },
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "**.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "nftstorage.link",
      },
    ],
  },
};

export default nextConfig;
