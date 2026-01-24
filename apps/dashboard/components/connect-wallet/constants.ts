export const DESKTOP_CONNECTORS: ReadonlyArray<{ id: string; label: string }> =
  [
    { id: "wallet-standard:phantom", label: "phantom" },
    { id: "wallet-standard:solflare", label: "solflare" },
    { id: "wallet-standard:backpack", label: "backpack" },
  ];

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
