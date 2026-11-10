/**
 * Builders for synthetic, kit-shaped getTransaction responses (test-only).
 */
import type { Rpc, GetTransactionApi } from "@solana/kit";

export const SOL = 1_000_000_000n;

export interface SyntheticTxInput {
  staticKeys: string[];
  loaded?: { writable: readonly string[]; readonly: readonly string[] } | null;
  pre: bigint[];
  post: bigint[];
  fee?: bigint;
  /** top-level instructions as [programIdIndex, ...] */
  instructions?: Array<{ programIdIndex: number; accounts?: number[]; data?: string }>;
  version?: 0 | "legacy";
  metaNull?: boolean;
}

export function syntheticResponse(input: SyntheticTxInput) {
  const {
    staticKeys,
    loaded,
    pre,
    post,
    fee = 5000n,
    instructions = [{ programIdIndex: staticKeys.length - 1, accounts: [0, 1] }],
    version = 0,
    metaNull = false,
  } = input;
  return {
    slot: 1000n,
    blockTime: 1700000000n,
    version,
    meta: metaNull
      ? null
      : {
          fee,
          err: null,
          logMessages: [],
          preBalances: pre,
          postBalances: post,
          preTokenBalances: [],
          postTokenBalances: [],
          ...(loaded === undefined || loaded === null
            ? {}
            : { loadedAddresses: loaded }),
        },
    transaction: {
      message: {
        accountKeys: staticKeys,
        instructions,
        recentBlockhash: "11111111111111111111111111111111",
      },
      signatures: ["sig"],
    },
  };
}

/** Mock RPC answering every getTransaction with the given response(s). */
export function mockRpc(
  responder: (signature: string) => unknown | Promise<unknown>,
): { rpc: Rpc<GetTransactionApi>; calls: string[] } {
  const calls: string[] = [];
  const rpc = {
    getTransaction: (signature: string) => ({
      send: async () => {
        calls.push(String(signature));
        return responder(String(signature));
      },
    }),
  } as unknown as Rpc<GetTransactionApi>;
  return { rpc, calls };
}

export const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export const SENDER = "SenderWa11et111111111111111111111111111111111";
export const RECEIVER = "Receiver1111111111111111111111111111111111111";
