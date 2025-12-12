import type { ProtocolInfo } from "@tx-indexer/core/actors/counterparty.types";
import {
  JUPITER_V6_PROGRAM_ID,
  JUPITER_V4_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  COMPUTE_BUDGET_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  METAPLEX_PROGRAM_ID,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  RAYDIUM_PROGRAM_ID,
  STAKE_PROGRAM_ID,
} from "@tx-indexer/solana/constants/program-ids";
import { DEX_PROTOCOL_IDS } from "@tx-indexer/solana/constants/protocol-constants";

const KNOWN_PROGRAMS: Record<string, ProtocolInfo> = {
  [JUPITER_V6_PROGRAM_ID]: {
    id: "jupiter",
    name: "Jupiter",
  },
  [JUPITER_V4_PROGRAM_ID]: {
    id: "jupiter-v4",
    name: "Jupiter V4",
  },
  [TOKEN_PROGRAM_ID]: {
    id: "spl-token",
    name: "Token Program",
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
  [METAPLEX_PROGRAM_ID]: {
    id: "metaplex",
    name: "Metaplex",
  },
  [ORCA_WHIRLPOOL_PROGRAM_ID]: {
    id: "orca-whirlpool",
    name: "Orca Whirlpool",
  },
  [RAYDIUM_PROGRAM_ID]: {
    id: "raydium",
    name: "Raydium",
  },
  [STAKE_PROGRAM_ID]: {
    id: "stake",
    name: "Stake Program",
  },
};

const PRIORITY_ORDER = [
  "jupiter",
  "jupiter-v4",
  "raydium",
  "orca-whirlpool",
  "metaplex",
  "stake",
  "associated-token",
  "spl-token",
  "compute-budget",
  "system",
];

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

