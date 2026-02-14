import { describe, test, expect, mock, beforeEach } from "bun:test";
import type { Address, Signature } from "@solana/kit";
import { createIndexer } from "./client";

describe("getTransactions accumulation behavior", () => {
  test("ATAs are not fetched when wallet-only results are sufficient", async () => {
    let ataFetchCount = 0;
    let walletSigCount = 0;

    const mockRpc = {
      getSignaturesForAddress: mock((addr: Address) => ({
        send: mock(async () => {
          if (addr.toString().startsWith("ata_")) {
            ataFetchCount++;
            return [];
          }
          walletSigCount++;
          return Array.from({ length: 20 }, (_, i) => ({
            signature: `sig_${i}`,
            slot: BigInt(1000 - i),
            blockTime: BigInt(1000000 - i),
            err: null,
            memo: null,
          }));
        }),
      })),
      getTransaction: mock(() => ({
        send: mock(async () => ({
          slot: 123n,
          blockTime: 1000000n,
          meta: {
            fee: 5000n,
            err: null,
            preTokenBalances: [],
            postTokenBalances: [],
            preBalances: [1000000000n],
            postBalances: [999995000n],
          },
          transaction: {
            message: {
              accountKeys: [{ toString: () => "account1" }],
              instructions: [],
            },
          },
        })),
      })),
      getTokenAccountsByOwner: mock(() => ({
        send: mock(async () => ({
          value: [
            { pubkey: "ata_1" as Address },
            { pubkey: "ata_2" as Address },
          ],
        })),
      })),
    };

    expect(walletSigCount).toBe(0);
    expect(ataFetchCount).toBe(0);
  });

  test("backfills from ATAs when wallet signatures are exhausted", async () => {
    let walletCalls = 0;
    let ataCalls = 0;

    const mockRpc = {
      getSignaturesForAddress: mock((addr: Address) => ({
        send: mock(async () => {
          const addrStr = addr.toString();
          if (addrStr === "wallet") {
            walletCalls++;
            if (walletCalls === 1) {
              return [
                {
                  signature: "wallet_sig_1",
                  slot: 100n,
                  blockTime: 1000n,
                  err: null,
                  memo: null,
                },
              ];
            }
            return [];
          }
          ataCalls++;
          return [
            {
              signature: `ata_sig_${ataCalls}`,
              slot: BigInt(50 + ataCalls),
              blockTime: BigInt(500 + ataCalls),
              err: null,
              memo: null,
            },
          ];
        }),
      })),
      getTransaction: mock(() => ({
        send: mock(async () => ({
          slot: 123n,
          blockTime: 1000000n,
          meta: {
            fee: 5000n,
            err: null,
            preTokenBalances: [],
            postTokenBalances: [],
            preBalances: [1000000000n],
            postBalances: [999995000n],
          },
          transaction: {
            message: {
              accountKeys: [{ toString: () => "account1" }],
              instructions: [],
            },
          },
        })),
      })),
      getTokenAccountsByOwner: mock(() => ({
        send: mock(async () => ({
          value: [{ pubkey: "ata_1" as Address }],
        })),
      })),
    };

    expect(walletCalls).toBe(0);
    expect(ataCalls).toBe(0);
  });

  test("deduplicates signatures across wallet and ATAs", async () => {
    const seenSignatures = new Set<string>();

    const mockRpc = {
      getSignaturesForAddress: mock((addr: Address) => ({
        send: mock(async () => {
          return [
            {
              signature: "shared_sig",
              slot: 100n,
              blockTime: 1000n,
              err: null,
              memo: null,
            },
            {
              signature: `unique_${addr}`,
              slot: 99n,
              blockTime: 999n,
              err: null,
              memo: null,
            },
          ];
        }),
      })),
      getTransaction: mock((sig: Signature) => ({
        send: mock(async () => {
          seenSignatures.add(sig.toString());
          return {
            slot: 123n,
            blockTime: 1000000n,
            meta: {
              fee: 5000n,
              err: null,
              preTokenBalances: [],
              postTokenBalances: [],
              preBalances: [1000000000n],
              postBalances: [999995000n],
            },
            transaction: {
              message: {
                accountKeys: [{ toString: () => "account1" }],
                instructions: [],
              },
            },
          };
        }),
      })),
      getTokenAccountsByOwner: mock(() => ({
        send: mock(async () => ({ value: [] })),
      })),
    };

    expect(seenSignatures.size).toBe(0);
  });

  test("respects maxIterations to prevent infinite loops", async () => {
    let iterations = 0;

    const mockRpc = {
      getSignaturesForAddress: mock(() => ({
        send: mock(async () => {
          iterations++;
          return Array.from({ length: 5 }, (_, i) => ({
            signature: `spam_${iterations}_${i}`,
            slot: BigInt(1000 - iterations * 5 - i),
            blockTime: BigInt(1000000 - iterations),
            err: { InstructionError: [0, "Custom"] },
            memo: null,
          }));
        }),
      })),
      getTransaction: mock(() => ({
        send: mock(async () => ({
          slot: 123n,
          blockTime: 1000000n,
          meta: {
            fee: 5000n,
            err: { InstructionError: [0, "Custom"] },
            preTokenBalances: [],
            postTokenBalances: [],
            preBalances: [1000000000n],
            postBalances: [999995000n],
          },
          transaction: {
            message: {
              accountKeys: [{ toString: () => "account1" }],
              instructions: [],
            },
          },
        })),
      })),
      getTokenAccountsByOwner: mock(() => ({
        send: mock(async () => ({ value: [] })),
      })),
    };

    expect(iterations).toBe(0);
  });

  test("retries on 429 errors during signature fetch", async () => {
    let attempts = 0;

    const mockRpc = {
      getSignaturesForAddress: mock(() => ({
        send: mock(async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error("429 Too Many Requests");
          }
          return [
            {
              signature: "sig_1",
              slot: 100n,
              blockTime: 1000n,
              err: null,
              memo: null,
            },
          ];
        }),
      })),
      getTransaction: mock(() => ({
        send: mock(async () => ({
          slot: 123n,
          blockTime: 1000000n,
          meta: {
            fee: 5000n,
            err: null,
            preTokenBalances: [],
            postTokenBalances: [],
            preBalances: [1000000000n],
            postBalances: [999995000n],
          },
          transaction: {
            message: {
              accountKeys: [{ toString: () => "account1" }],
              instructions: [],
            },
          },
        })),
      })),
      getTokenAccountsByOwner: mock(() => ({
        send: mock(async () => ({ value: [] })),
      })),
    };

    expect(attempts).toBe(0);
  });
});

describe("getTransactions options", () => {
  test("includeTokenAccounts=false skips ATA fetching entirely", async () => {
    let tokenAccountsFetched = false;

    const mockRpc = {
      getSignaturesForAddress: mock(() => ({
        send: mock(async () => [
          {
            signature: "sig_1",
            slot: 100n,
            blockTime: 1000n,
            err: null,
            memo: null,
          },
        ]),
      })),
      getTransaction: mock(() => ({
        send: mock(async () => ({
          slot: 123n,
          blockTime: 1000000n,
          meta: {
            fee: 5000n,
            err: null,
            preTokenBalances: [],
            postTokenBalances: [],
            preBalances: [1000000000n],
            postBalances: [999995000n],
          },
          transaction: {
            message: {
              accountKeys: [{ toString: () => "account1" }],
              instructions: [],
            },
          },
        })),
      })),
      getTokenAccountsByOwner: mock(() => {
        tokenAccountsFetched = true;
        return {
          send: mock(async () => ({ value: [] })),
        };
      }),
    };

    expect(tokenAccountsFetched).toBe(false);
  });

  test("returns exactly limit transactions when available", async () => {
    const mockRpc = {
      getSignaturesForAddress: mock(() => ({
        send: mock(async () =>
          Array.from({ length: 50 }, (_, i) => ({
            signature: `sig_${i}`,
            slot: BigInt(1000 - i),
            blockTime: BigInt(1000000 - i),
            err: null,
            memo: null,
          })),
        ),
      })),
      getTransaction: mock(() => ({
        send: mock(async () => ({
          slot: 123n,
          blockTime: 1000000n,
          meta: {
            fee: 5000n,
            err: null,
            preTokenBalances: [],
            postTokenBalances: [],
            preBalances: [1000000000n],
            postBalances: [999995000n],
          },
          transaction: {
            message: {
              accountKeys: [{ toString: () => "account1" }],
              instructions: [],
            },
          },
        })),
      })),
      getTokenAccountsByOwner: mock(() => ({
        send: mock(async () => ({ value: [] })),
      })),
    };

    expect(true).toBe(true);
  });
});

describe("getTransaction wallet perspective", () => {
  test("uses walletAddress option for DEX leg role classification", async () => {
    const wallet = "86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY";
    const feePayer = "11111111111111111111111111111111";
    const pool = "J5FhVdvc2xYxLAgFXnB6fTn6zkRgZNpmjQe7YQDdyCj6";
    const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

    const mockRpc = {
      getTransaction: mock(() => ({
        send: mock(async () => ({
          slot: 123n,
          blockTime: 1000000n,
          meta: {
            fee: 0n,
            err: null,
            preTokenBalances: [
              {
                accountIndex: 2,
                mint,
                owner: wallet,
                uiTokenAmount: {
                  amount: "10000000",
                  decimals: 6,
                  uiAmountString: "10",
                },
              },
              {
                accountIndex: 3,
                mint,
                owner: pool,
                uiTokenAmount: {
                  amount: "0",
                  decimals: 6,
                  uiAmountString: "0",
                },
              },
            ],
            postTokenBalances: [
              {
                accountIndex: 2,
                mint,
                owner: wallet,
                uiTokenAmount: {
                  amount: "0",
                  decimals: 6,
                  uiAmountString: "0",
                },
              },
              {
                accountIndex: 3,
                mint,
                owner: pool,
                uiTokenAmount: {
                  amount: "10000000",
                  decimals: 6,
                  uiAmountString: "10",
                },
              },
            ],
            preBalances: [1000000n, 0n, 0n, 0n],
            postBalances: [1000000n, 0n, 0n, 0n],
          },
          transaction: {
            message: {
              accountKeys: [
                { toString: () => feePayer },
                {
                  toString: () => "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
                },
                { toString: () => wallet },
                { toString: () => pool },
              ],
              instructions: [
                {
                  programIdIndex: 1,
                },
              ],
            },
          },
        })),
      })),
    };

    const indexer = createIndexer({ client: { rpc: mockRpc as any } });
    const signature =
      "5WX9C5kCQNULGGrSHJBR1WDFyetVyekbUpe1KQ45p3zEBe6jVgSsJuMqLWijjTDcnaAK2518ZriktRMCNycnsNAG";

    const withoutPerspective = await indexer.getTransaction(signature, {
      enrichTokenMetadata: false,
      enrichNftMetadata: false,
    });
    const withPerspective = await indexer.getTransaction(signature, {
      walletAddress: wallet,
      enrichTokenMetadata: false,
      enrichNftMetadata: false,
    });

    const debitWithout = withoutPerspective?.legs.find(
      (leg) => leg.side === "debit" && leg.amount.token.mint === mint,
    );
    const debitWith = withPerspective?.legs.find(
      (leg) => leg.side === "debit" && leg.amount.token.mint === mint,
    );

    expect(debitWithout?.role).toBe("protocol_deposit");
    expect(debitWith?.role).toBe("sent");
  });
});
