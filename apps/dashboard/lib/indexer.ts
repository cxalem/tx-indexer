import { createIndexer, type TxIndexer } from "tx-indexer";

let _indexer: TxIndexer | null = null;

function getHeliusApiKey(rpcUrl: string): string | undefined {
  try {
    const parsed = new URL(rpcUrl);
    return (
      parsed.searchParams.get("api-key") ??
      parsed.searchParams.get("api_key") ??
      process.env.HELIUS_API_KEY
    );
  } catch {
    return process.env.HELIUS_API_KEY;
  }
}

export function getIndexer(): TxIndexer {
  if (!_indexer) {
    if (!process.env.SERVER_RPC_URL) {
      throw new Error("SERVER_RPC_URL environment variable is not set");
    }
    const heliusApiKey = getHeliusApiKey(process.env.SERVER_RPC_URL);
    _indexer = createIndexer({
      rpcUrl: process.env.SERVER_RPC_URL,
      heliusApiKey,
    });
  }
  return _indexer;
}

export const indexer = {
  getBalance: (...args: Parameters<TxIndexer["getBalance"]>) =>
    getIndexer().getBalance(...args),
  getTransactions: (...args: Parameters<TxIndexer["getTransactions"]>) =>
    getIndexer().getTransactions(...args),
};
