import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No need to expose RPC_URL - it's automatically available in server actions
  // NEXT_PUBLIC_* vars are automatically exposed to the client
  experimental: {
    // Optimize barrel imports for faster dev boot and smaller bundles
    // lucide-react has 1500+ icons - direct imports save ~200-800ms cold start
    optimizePackageImports: ["lucide-react"],
  },
  // Exclude problematic WASM packages from bundling
  // @lightprotocol/hasher.rs has WASM files that Turbopack can't handle
  serverExternalPackages: ["@lightprotocol/hasher.rs", "privacycash"],
};

// Wrap with bundle analyzer when ANALYZE=true
// Usage: ANALYZE=true npm run build
// First install: npm install --save-dev @next/bundle-analyzer
const withBundleAnalyzer = async (config: NextConfig): Promise<NextConfig> => {
  if (process.env.ANALYZE === "true") {
    try {
      const bundleAnalyzer = await import("@next/bundle-analyzer");
      return bundleAnalyzer.default({
        enabled: true,
        openAnalyzer: true,
      })(config);
    } catch {
      console.warn(
        "Bundle analyzer not installed. Run: npm install --save-dev @next/bundle-analyzer",
      );
      return config;
    }
  }
  return config;
};

export default withBundleAnalyzer(nextConfig);
