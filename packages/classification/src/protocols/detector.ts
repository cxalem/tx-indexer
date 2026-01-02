import type { ProtocolInfo } from "@tx-indexer/core/actors/counterparty.types";
import {
  // Core programs
  JUPITER_V6_PROGRAM_ID,
  JUPITER_V4_PROGRAM_ID,
  JUPITER_ORDER_ENGINE_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  COMPUTE_BUDGET_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  SPL_MEMO_PROGRAM_ID,
  MEMO_V1_PROGRAM_ID,
  // DEX programs
  RAYDIUM_PROGRAM_ID,
  RAYDIUM_CLMM_PROGRAM_ID,
  RAYDIUM_CPMM_PROGRAM_ID,
  RAYDIUM_STABLE_PROGRAM_ID,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  ORCA_TOKEN_SWAP_V1_PROGRAM_ID,
  OPENBOOK_V2_PROGRAM_ID,
  PHOENIX_PROGRAM_ID,
  SABER_STABLE_SWAP_PROGRAM_ID,
  MERCURIAL_STABLE_SWAP_PROGRAM_ID,
  METEORA_DLMM_PROGRAM_ID,
  METEORA_POOLS_PROGRAM_ID,
  PUMPFUN_AMM_PROGRAM_ID,
  PUMPFUN_BONDING_CURVE_PROGRAM_ID,
  LIFINITY_V2_PROGRAM_ID,
  // NFT programs
  METAPLEX_PROGRAM_ID,
  CANDY_GUARD_PROGRAM_ID,
  CANDY_MACHINE_V3_PROGRAM_ID,
  BUBBLEGUM_PROGRAM_ID,
  MAGIC_EDEN_CANDY_MACHINE_ID,
  // Staking programs
  STAKE_POOL_PROGRAM_ID,
  STAKE_PROGRAM_ID,
  // Bridge programs
  WORMHOLE_PROGRAM_ID,
  WORMHOLE_TOKEN_BRIDGE_ID,
  DEGODS_BRIDGE_PROGRAM_ID,
  DEBRIDGE_PROGRAM_ID,
  ALLBRIDGE_PROGRAM_ID,
} from "@tx-indexer/solana/constants/program-ids";

const KNOWN_PROGRAMS: Record<string, ProtocolInfo> = {
  // Jupiter aggregator
  [JUPITER_V6_PROGRAM_ID]: {
    id: "jupiter",
    name: "Jupiter",
  },
  [JUPITER_V4_PROGRAM_ID]: {
    id: "jupiter-v4",
    name: "Jupiter V4",
  },
  [JUPITER_ORDER_ENGINE_PROGRAM_ID]: {
    id: "jupiter-limit-order",
    name: "Jupiter Limit Order",
  },

  // Core token programs
  [TOKEN_PROGRAM_ID]: {
    id: "spl-token",
    name: "Token Program",
  },
  [TOKEN_2022_PROGRAM_ID]: {
    id: "token-2022",
    name: "Token-2022 Program",
  },
  [SYSTEM_PROGRAM_ID]: {
    id: "system",
    name: "System Program",
  },
  [COMPUTE_BUDGET_PROGRAM_ID]: {
    id: "compute-budget",
    name: "Compute Budget",
  },
  [ASSOCIATED_TOKEN_PROGRAM_ID]: {
    id: "associated-token",
    name: "Associated Token Program",
  },

  // Memo programs
  [SPL_MEMO_PROGRAM_ID]: {
    id: "memo",
    name: "Memo Program",
  },
  [MEMO_V1_PROGRAM_ID]: {
    id: "memo-v1",
    name: "Memo Program V1",
  },

  // Raydium AMMs
  [RAYDIUM_PROGRAM_ID]: {
    id: "raydium",
    name: "Raydium",
  },
  [RAYDIUM_CLMM_PROGRAM_ID]: {
    id: "raydium-clmm",
    name: "Raydium CLMM",
  },
  [RAYDIUM_CPMM_PROGRAM_ID]: {
    id: "raydium-cpmm",
    name: "Raydium CPMM",
  },
  [RAYDIUM_STABLE_PROGRAM_ID]: {
    id: "raydium-stable",
    name: "Raydium Stable",
  },

  // Orca
  [ORCA_WHIRLPOOL_PROGRAM_ID]: {
    id: "orca-whirlpool",
    name: "Orca Whirlpool",
  },
  [ORCA_TOKEN_SWAP_V1_PROGRAM_ID]: {
    id: "orca-v1",
    name: "Orca Token Swap V1",
  },

  // CLOBs (Central Limit Order Books)
  [OPENBOOK_V2_PROGRAM_ID]: {
    id: "openbook",
    name: "OpenBook",
  },
  [PHOENIX_PROGRAM_ID]: {
    id: "phoenix",
    name: "Phoenix",
  },

  // Stableswap protocols
  [SABER_STABLE_SWAP_PROGRAM_ID]: {
    id: "saber",
    name: "Saber",
  },
  [MERCURIAL_STABLE_SWAP_PROGRAM_ID]: {
    id: "mercurial",
    name: "Mercurial",
  },

  // Meteora
  [METEORA_DLMM_PROGRAM_ID]: {
    id: "meteora-dlmm",
    name: "Meteora DLMM",
  },
  [METEORA_POOLS_PROGRAM_ID]: {
    id: "meteora-pools",
    name: "Meteora Pools",
  },

  // Pump.fun
  [PUMPFUN_AMM_PROGRAM_ID]: {
    id: "pumpfun",
    name: "Pump.fun",
  },
  [PUMPFUN_BONDING_CURVE_PROGRAM_ID]: {
    id: "pumpfun-bonding",
    name: "Pump.fun Bonding Curve",
  },

  // Lifinity
  [LIFINITY_V2_PROGRAM_ID]: {
    id: "lifinity",
    name: "Lifinity",
  },

  // NFT programs
  [METAPLEX_PROGRAM_ID]: {
    id: "metaplex",
    name: "Metaplex",
  },
  [CANDY_GUARD_PROGRAM_ID]: {
    id: "candy-guard",
    name: "Metaplex Candy Guard Program",
  },
  [CANDY_MACHINE_V3_PROGRAM_ID]: {
    id: "candy-machine-v3",
    name: "Metaplex Candy Machine Core Program",
  },
  [BUBBLEGUM_PROGRAM_ID]: {
    id: "bubblegum",
    name: "Bubblegum Program",
  },
  [MAGIC_EDEN_CANDY_MACHINE_ID]: {
    id: "magic-eden-candy-machine",
    name: "Nft Candy Machine Program (Magic Eden)",
  },

  // Staking programs
  [STAKE_PROGRAM_ID]: {
    id: "stake",
    name: "Stake Program",
  },
  [STAKE_POOL_PROGRAM_ID]: {
    id: "stake-pool",
    name: "Stake Pool Program",
  },

  // Bridge programs
  [WORMHOLE_PROGRAM_ID]: {
    id: "wormhole",
    name: "Wormhole",
  },
  [WORMHOLE_TOKEN_BRIDGE_ID]: {
    id: "wormhole-token-bridge",
    name: "Wormhole Token Bridge",
  },
  [DEGODS_BRIDGE_PROGRAM_ID]: {
    id: "degods-bridge",
    name: "DeGods Bridge",
  },
  [DEBRIDGE_PROGRAM_ID]: {
    id: "debridge",
    name: "deBridge",
  },
  [ALLBRIDGE_PROGRAM_ID]: {
    id: "allbridge",
    name: "Allbridge",
  },
};

const PRIORITY_ORDER = [
  // Bridge protocols (highest priority - cross-chain operations)
  "wormhole",
  "wormhole-token-bridge",
  "degods-bridge",
  "debridge",
  "allbridge",
  // DEX aggregators (route through multiple DEXes)
  "jupiter",
  "jupiter-v4",
  "jupiter-limit-order",
  // AMMs and DEXes
  "raydium",
  "raydium-clmm",
  "raydium-cpmm",
  "raydium-stable",
  "orca-whirlpool",
  "orca-v1",
  "meteora-dlmm",
  "meteora-pools",
  "lifinity",
  "pumpfun",
  "pumpfun-bonding",
  // CLOBs
  "openbook",
  "phoenix",
  // Stableswap
  "saber",
  "mercurial",
  // NFT
  "metaplex",
  "candy-guard",
  "candy-machine-v3",
  "bubblegum",
  "magic-eden-candy-machine",
  // Staking
  "stake",
  "stake-pool",
  // Infrastructure (lowest priority)
  "memo",
  "memo-v1",
  "associated-token",
  "spl-token",
  "token-2022",
  "compute-budget",
  "system",
];

/**
 * Protocol IDs that are DEX (decentralized exchange) protocols.
 * These protocols perform swaps and should have their legs tagged as "protocol:"
 * with deposit/withdraw roles.
 */
const DEX_PROTOCOL_IDS = new Set([
  // Jupiter aggregator
  "jupiter",
  "jupiter-v4",
  "jupiter-limit-order",
  // Raydium AMMs
  "raydium",
  "raydium-clmm",
  "raydium-cpmm",
  "raydium-stable",
  // Orca
  "orca-whirlpool",
  "orca-v1",
  // CLOBs
  "openbook",
  "phoenix",
  // Stableswap
  "saber",
  "mercurial",
  // Meteora
  "meteora-dlmm",
  "meteora-pools",
  // Pump.fun
  "pumpfun",
  "pumpfun-bonding",
  // Lifinity
  "lifinity",
]);

const NFT_MINT_PROTOCOL_IDS = new Set([
  "metaplex",
  "candy-machine-v3",
  "candy-guard",
  "bubblegum",
  "magic-eden-candy-machine",
]);

const STAKE_PROTOCOL_IDS = new Set(["stake", "stake-pool"]);

const BRIDGE_PROTOCOL_IDS = new Set([
  "wormhole",
  "wormhole-token-bridge",
  "degods-bridge",
  "debridge",
  "allbridge",
]);

/**
 * Checks if a protocol is a DEX (decentralized exchange) that performs swaps.
 * DEX protocols should have their legs tagged as "protocol:" with deposit/withdraw roles.
 * Non-DEX protocols (like Associated Token Program) are infrastructure and should not
 * affect leg tagging.
 */
export function isDexProtocol(protocol: ProtocolInfo | null): boolean {
  return protocol !== null && DEX_PROTOCOL_IDS.has(protocol.id);
}

/**
 * Checks if a protocol ID string corresponds to a DEX protocol.
 * Useful when you only have the protocol ID string, not the full ProtocolInfo object.
 */
export function isDexProtocolById(protocolId: string | undefined): boolean {
  return protocolId !== undefined && DEX_PROTOCOL_IDS.has(protocolId);
}

/**
 * Checks if a protocol ID string corresponds to a NFT Mint
 */
export function isNftMintProtocolById(protocolId: string | undefined): boolean {
  return protocolId !== undefined && NFT_MINT_PROTOCOL_IDS.has(protocolId);
}

/**
 * Checks if a protocol ID string corresponds to a stake
 */

export function isStakeProtocolById(protocolId: string | undefined): boolean {
  return protocolId !== undefined && STAKE_PROTOCOL_IDS.has(protocolId);
}

/**
 * Checks if a protocol ID string corresponds to a bridge protocol
 */
export function isBridgeProtocolById(protocolId: string | undefined): boolean {
  return protocolId !== undefined && BRIDGE_PROTOCOL_IDS.has(protocolId);
}

/**
 * Detects the primary protocol used in a transaction based on its program IDs.
 *
 * When multiple protocols are detected, returns the highest priority protocol
 * according to the PRIORITY_ORDER (e.g., Jupiter > Raydium > Token Program).
 *
 * @param programIds - Array of program IDs involved in the transaction
 * @returns The detected protocol information, or null if no known protocol is found
 */
export function detectProtocol(programIds: string[]): ProtocolInfo | null {
  const detectedProtocols: ProtocolInfo[] = [];

  for (const programId of programIds) {
    const protocol = KNOWN_PROGRAMS[programId];
    if (protocol) {
      detectedProtocols.push(protocol);
    }
  }

  if (detectedProtocols.length === 0) {
    return null;
  }

  detectedProtocols.sort((a, b) => {
    const aPriority = PRIORITY_ORDER.indexOf(a.id);
    const bPriority = PRIORITY_ORDER.indexOf(b.id);
    return aPriority - bPriority;
  });

  return detectedProtocols[0] ?? null;
}
