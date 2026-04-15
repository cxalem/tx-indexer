export const MOBILE_WALLETS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "phantom", label: "phantom" },
];

export type ConnectionMode = "desktop" | "mobile" | "wallet-browser" | "pwa";

export function createSignInMessage(
  walletAddress: string,
  nonce: string,
): string {
  const domain = typeof window !== "undefined" ? window.location.host : "app";
  const timestamp = new Date().toISOString();

  return `Sign in to ${domain}

Wallet: ${walletAddress}
Nonce: ${nonce}
Issued At: ${timestamp}

This request will not trigger a blockchain transaction or cost any gas fees.`;
}
