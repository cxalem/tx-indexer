import { WatchActivity } from "@/components/watch/watch-activity";

interface WatchAddressPageProps {
  params: Promise<{ address: string }>;
}

export default async function WatchAddressPage({
  params,
}: WatchAddressPageProps) {
  const { address } = await params;

  return <WatchActivity walletAddress={address} />;
}
