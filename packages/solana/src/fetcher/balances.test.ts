import { describe, test, expect, mock } from "bun:test";
import type {
  Address,
  Rpc,
  GetBalanceApi,
  GetTokenAccountsByOwnerApi,
} from "@solana/kit";
import { fetchWalletBalance } from "./balances";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "../constants/program-ids";

function createMockTokenAccount(
  mint: string,
  amount: string,
  decimals: number,
) {
  return {
    pubkey: { toString: () => `token_account_${mint.slice(0, 8)}` },
    account: {
      data: {
        parsed: {
          info: {
            mint,
            tokenAmount: {
              amount,
              decimals,
              uiAmountString: (
                Number(amount) / Math.pow(10, decimals)
              ).toString(),
            },
          },
        },
      },
    },
  };
}

function createMockRpc(options: {
  solBalance?: bigint;
  tokenProgramAccounts?: ReturnType<typeof createMockTokenAccount>[];
  token2022Accounts?: ReturnType<typeof createMockTokenAccount>[];
}): Rpc<GetBalanceApi & GetTokenAccountsByOwnerApi> {
  const {
    solBalance = 1000000000n,
    tokenProgramAccounts = [],
    token2022Accounts = [],
  } = options;

  return {
    getBalance: mock(() => ({
      send: mock(async () => ({ value: solBalance })),
    })),
    getTokenAccountsByOwner: mock(
      (walletAddress: Address, filter: { programId: Address }) => ({
        send: mock(async () => {
          const programId = filter.programId.toString();
          if (programId === TOKEN_PROGRAM_ID) {
            return { value: tokenProgramAccounts };
          }
          if (programId === TOKEN_2022_PROGRAM_ID) {
            return { value: token2022Accounts };
          }
          return { value: [] };
        }),
      }),
    ),
  } as unknown as Rpc<GetBalanceApi & GetTokenAccountsByOwnerApi>;
}

describe("fetchWalletBalance", () => {
  const mockWalletAddress = "wallet123" as Address;

  test("returns SOL balance", async () => {
    const rpc = createMockRpc({ solBalance: 5000000000n });

    const balance = await fetchWalletBalance(rpc, mockWalletAddress);

    expect(balance.sol.lamports).toBe(5000000000n);
    expect(balance.sol.ui).toBe(5);
  });

  test("returns tokens from Token Program", async () => {
    const rpc = createMockRpc({
      tokenProgramAccounts: [
        createMockTokenAccount("USDC_MINT_ADDRESS", "1000000", 6),
      ],
    });

    const balance = await fetchWalletBalance(rpc, mockWalletAddress);

    expect(balance.tokens).toHaveLength(1);
    expect(balance.tokens[0]!.mint).toBe("USDC_MINT_ADDRESS");
    expect(balance.tokens[0]!.amount.ui).toBe(1);
  });

  test("returns tokens from Token-2022 Program", async () => {
    const rpc = createMockRpc({
      token2022Accounts: [
        createMockTokenAccount("TOKEN2022_MINT", "2000000000", 9),
      ],
    });

    const balance = await fetchWalletBalance(rpc, mockWalletAddress);

    expect(balance.tokens).toHaveLength(1);
    expect(balance.tokens[0]!.mint).toBe("TOKEN2022_MINT");
    expect(balance.tokens[0]!.amount.ui).toBe(2);
  });

  test("combines tokens from both Token Program and Token-2022", async () => {
    const rpc = createMockRpc({
      tokenProgramAccounts: [
        createMockTokenAccount("SPL_TOKEN_MINT", "1000000", 6),
      ],
      token2022Accounts: [
        createMockTokenAccount("TOKEN2022_MINT", "500000000", 9),
      ],
    });

    const balance = await fetchWalletBalance(rpc, mockWalletAddress);

    expect(balance.tokens).toHaveLength(2);

    const mints = balance.tokens.map((t) => t.mint);
    expect(mints).toContain("SPL_TOKEN_MINT");
    expect(mints).toContain("TOKEN2022_MINT");
  });

  test("handles empty token accounts", async () => {
    const rpc = createMockRpc({});

    const balance = await fetchWalletBalance(rpc, mockWalletAddress);

    expect(balance.tokens).toHaveLength(0);
  });

  test("continues if one program query fails", async () => {
    const rpc = {
      getBalance: mock(() => ({
        send: mock(async () => ({ value: 1000000000n })),
      })),
      getTokenAccountsByOwner: mock(
        (walletAddress: Address, filter: { programId: Address }) => ({
          send: mock(async () => {
            const programId = filter.programId.toString();
            if (programId === TOKEN_PROGRAM_ID) {
              throw new Error("RPC error");
            }
            return {
              value: [
                createMockTokenAccount("TOKEN2022_MINT", "1000000000", 9),
              ],
            };
          }),
        }),
      ),
    } as unknown as Rpc<GetBalanceApi & GetTokenAccountsByOwnerApi>;

    const balance = await fetchWalletBalance(rpc, mockWalletAddress);

    expect(balance.tokens).toHaveLength(1);
    expect(balance.tokens[0]!.mint).toBe("TOKEN2022_MINT");
  });
});
