import { WatchAssets } from "@/components/watch/watch-assets";

interface WatchAssetsPageProps {
  params: Promise<{ address: string }>;
}

export default async function WatchAssetsPage({
  params,
}: WatchAssetsPageProps) {
  const { address } = await params;

  return <WatchAssets walletAddress={address} />;
}
