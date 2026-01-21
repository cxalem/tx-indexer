export * from "./protocols/detector";
export * from "./engine/classification-service";
export * from "./engine/classifier.interface";
export * from "./engine/leg-helpers";
export * from "./classifiers/transfer-classifier";
export * from "./classifiers/swap-classifier";
export * from "./classifiers/airdrop-classifier";
export * from "./classifiers/fee-only-classifier";
export * from "./classifiers/solana-pay-classifier";

// Privacy classifiers (Solana Privacy Hack 2026)
export * from "./classifiers/privacy-cash-classifier";

// NOTE: SilentSwap does NOT have a Solana program ID.
// SilentSwap transactions appear as normal relay.link bridge transactions.
// Privacy is achieved via off-chain facilitator account obfuscation.
// Therefore, we cannot create an on-chain classifier for SilentSwap.

// Re-export Solana constants for convenience
export * from "@tx-indexer/solana/constants/program-ids";
