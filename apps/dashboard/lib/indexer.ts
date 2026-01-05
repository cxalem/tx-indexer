import { createIndexer, type TxIndexer } from "tx-indexer";

let _indexer: TxIndexer | null = null;

export function getIndexer(): TxIndexer {
  if (!_indexer) {
    if (!process.env.RPC_URL) {
      throw new Error("RPC_URL environment variable is not set");
    }
    _indexer = createIndexer({ rpcUrl: process.env.RPC_URL });
  }
  return _indexer;
}

export const indexer = {
  getBalance: (...args: Parameters<TxIndexer["getBalance"]>) =>
    getIndexer().getBalance(...args),
  getTransactions: (...args: Parameters<TxIndexer["getTransactions"]>) =>
    getIndexer().getTransactions(...args),
};
