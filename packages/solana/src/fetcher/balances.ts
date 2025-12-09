import type { Address, Rpc, GetBalanceApi } from "@solana/kit";

import {
  getTokenInfo,
  KNOWN_TOKENS,
  TRACKED_TOKENS,
} from "@domain/money/token-registry";

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

export async function fetchWalletBalance(
  rpc: Rpc<GetBalanceApi>,
  walletAddress: Address
): Promise<WalletBalance> {
  const balanceResponse = await rpc.getBalance(walletAddress).send();
  const lamports = balanceResponse.value;

  const tokenAccounts = await fetchTokenAccounts(rpc, walletAddress);

  const allTrackedTokens = mergeWithTrackedTokens(tokenAccounts);

  return {
    address: walletAddress,
    sol: {
      lamports,
      ui: Number(lamports) / 1e9,
    },
    tokens: allTrackedTokens,
  };
}

async function fetchTokenAccounts(
  rpc: any,
  walletAddress: Address
): Promise<Map<string, TokenAccountBalance>> {
  const accountsMap = new Map<string, TokenAccountBalance>();

  try {
    const response = await rpc
      .getTokenAccountsByOwner(
        walletAddress,
        { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { encoding: "jsonParsed" }
      )
      .send();

    for (const account of response.value) {
      const parsedInfo = account.account.data.parsed.info;
      const mintRaw = parsedInfo.mint;
      const mint = typeof mintRaw === "string" ? mintRaw : mintRaw.toString();

      const tokenInfo = getTokenInfo(mint);

      if (tokenInfo) {
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
          symbol: tokenInfo.symbol,
        });
      }
    }
  } catch (error) {
    console.error("Error fetching token accounts:", error);
  }

  return accountsMap;
}

function mergeWithTrackedTokens(
  fetchedAccounts: Map<string, TokenAccountBalance>
): TokenAccountBalance[] {
  const result: TokenAccountBalance[] = [];

  for (const mint of TRACKED_TOKENS) {
    if (mint === KNOWN_TOKENS.SOL) {
      continue;
    }

    const tokenInfo = getTokenInfo(mint);
    if (!tokenInfo) continue;

    const existing = fetchedAccounts.get(mint);
    if (existing) {
      result.push(existing);
    } else {
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

