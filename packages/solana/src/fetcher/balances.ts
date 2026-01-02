import {
  type Address,
  type Rpc,
  type GetBalanceApi,
  type GetTokenAccountsByOwnerApi,
  address,
} from "@solana/kit";

import {
  getTokenInfo,
  KNOWN_TOKENS,
} from "@tx-indexer/core/money/token-registry";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "../constants/program-ids";

export interface WalletBalance {
  address: string;
  sol: {
    lamports: bigint;
    ui: number;
  };
  tokens: TokenAccountBalance[];
}

export interface TokenAccountBalance {
  mint: string;
  tokenAccount?: string;
  amount: {
    raw: string;
    ui: number;
  };
  decimals: number;
  symbol: string;
}

/**
 * Fetches wallet balance including SOL and SPL tokens
 *
 * @param rpc - Solana RPC client
 * @param walletAddress - Wallet address to query
 * @param tokenMints - Optional array of token mint addresses to track. If omitted, returns all tokens in wallet
 * @returns Wallet balance data with SOL and token balances
 *
 * @example
 * // Fetch all tokens
 * const allBalances = await fetchWalletBalance(rpc, address);
 *
 * @example
 * // Fetch specific tokens only
 * const usdcOnly = await fetchWalletBalance(rpc, address, ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"]);
 */
export async function fetchWalletBalance(
  rpc: Rpc<GetBalanceApi & GetTokenAccountsByOwnerApi>,
  walletAddress: Address,
  tokenMints?: readonly string[],
): Promise<WalletBalance> {
  const balanceResponse = await rpc.getBalance(walletAddress).send();
  const lamports = balanceResponse.value;

  const tokenAccounts = await fetchTokenAccounts(rpc, walletAddress);

  const tokens = tokenMints
    ? filterToTrackedTokens(tokenAccounts, tokenMints)
    : Array.from(tokenAccounts.values());

  return {
    address: walletAddress,
    sol: {
      lamports,
      ui: Number(lamports) / 1e9,
    },
    tokens,
  };
}

async function fetchTokenAccounts(
  rpc: Rpc<GetBalanceApi & GetTokenAccountsByOwnerApi>,
  walletAddress: Address,
): Promise<Map<string, TokenAccountBalance>> {
  const accountsMap = new Map<string, TokenAccountBalance>();

  const tokenPrograms = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];

  const responses = await Promise.all(
    tokenPrograms.map((programId) =>
      rpc
        .getTokenAccountsByOwner(
          walletAddress,
          { programId: address(programId) },
          { encoding: "jsonParsed" },
        )
        .send()
        .catch(() => ({ value: [] })),
    ),
  );

  for (const response of responses) {
    for (const account of response.value) {
      const parsedInfo = account.account.data.parsed.info;
      const mint = parsedInfo.mint;

      const tokenInfo = getTokenInfo(mint);
      const symbol = tokenInfo?.symbol || mint.substring(0, 8);

      accountsMap.set(mint, {
        mint,
        tokenAccount: account.pubkey.toString(),
        amount: {
          raw: parsedInfo.tokenAmount.amount,
          ui: parsedInfo.tokenAmount.uiAmountString
            ? parseFloat(parsedInfo.tokenAmount.uiAmountString)
            : 0,
        },
        decimals: parsedInfo.tokenAmount.decimals,
        symbol,
      });
    }
  }

  return accountsMap;
}

/**
 * Filters token accounts to only include specified mints, adding zero balances for missing tokens
 *
 * @param fetchedAccounts - Map of mint addresses to token balances from RPC
 * @param tokenMints - Array of token mint addresses to include in results
 */
function filterToTrackedTokens(
  fetchedAccounts: Map<string, TokenAccountBalance>,
  tokenMints: readonly string[],
): TokenAccountBalance[] {
  const result: TokenAccountBalance[] = [];

  for (const mint of tokenMints) {
    if (mint === KNOWN_TOKENS.SOL) continue;

    const existing = fetchedAccounts.get(mint);
    if (existing) {
      result.push(existing);
    } else {
      const tokenInfo = getTokenInfo(mint);
      if (tokenInfo) {
        result.push({
          mint,
          amount: {
            raw: "0",
            ui: 0,
          },
          decimals: tokenInfo.decimals,
          symbol: tokenInfo.symbol,
        });
      }
    }
  }

  return result;
}

export function formatBalance(balance: WalletBalance): string[] {
  const lines: string[] = [];

  lines.push(`Wallet: ${balance.address}`);
  lines.push(`SOL: ${balance.sol.ui.toFixed(9)}`);

  for (const token of balance.tokens) {
    lines.push(`${token.symbol}: ${token.amount.ui.toFixed(token.decimals)}`);
  }

  return lines;
}
