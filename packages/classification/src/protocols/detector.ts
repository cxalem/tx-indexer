import type { ProtocolInfo } from "@domain/actors/counterparty.types";

const KNOWN_PROGRAMS: Record<string, ProtocolInfo> = {
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": {
    id: "jupiter",
    name: "Jupiter",
  },
  "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB": {
    id: "jupiter-v4",
    name: "Jupiter V4",
  },
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": {
    id: "spl-token",
    name: "Token Program",
  },
  "11111111111111111111111111111111": {
    id: "system",
    name: "System Program",
  },
  "ComputeBudget111111111111111111111111111111": {
    id: "compute-budget",
    name: "Compute Budget",
  },
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL": {
    id: "associated-token",
    name: "Associated Token Program",
  },
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s": {
    id: "metaplex",
    name: "Metaplex",
  },
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": {
    id: "orca-whirlpool",
    name: "Orca Whirlpool",
  },
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": {
    id: "raydium",
    name: "Raydium",
  },
  "Stake11111111111111111111111111111111111111": {
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

