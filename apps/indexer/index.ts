import { createSolanaClient, parseAddress } from "@solana/rpc/client";
import {
  fetchWalletSignatures,
  fetchTransactionsBatch,
} from "@solana/fetcher/transactions";
import { fetchWalletBalance, formatBalance } from "@solana/fetcher/balances";
import { detectProtocol } from "@classification/protocols/detector";
import {
  getWalletTokenChanges,
  getWalletSolChange,
} from "@solana/mappers/balance-parser";
import { TRACKED_TOKENS } from "@domain/money/token-registry";
import type { Signature } from "@solana/kit";

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;

async function main() {
  if (!WALLET_ADDRESS) {
    console.error("Error: WALLET_ADDRESS environment variable is required");
    console.error("Usage: WALLET_ADDRESS=<address> bun apps/indexer/index.ts");
    process.exit(1);
  }

  console.log("TX Indexer\n");
  console.log("============================================\n");

  const client = createSolanaClient(RPC_URL);
  const address = parseAddress(WALLET_ADDRESS);

  const balance = await fetchWalletBalance(client.rpc, address);
  
  console.log("Current Balance");
  console.log("--------------------------------------------");
  console.log(`Address: ${WALLET_ADDRESS.slice(0, 8)}...${WALLET_ADDRESS.slice(-8)}`);
  console.log(`SOL: ${balance.sol.ui.toFixed(9)}`);
  
  for (const token of balance.tokens) {
    console.log(`${token.symbol}: ${token.amount.ui.toFixed(token.decimals)}`);
  }
  
  console.log();
  console.log("Recent Transactions");
  console.log("--------------------------------------------");

  const signatures = await fetchWalletSignatures(client.rpc, address, {
    limit: 3,
  });

  const transactions = await fetchTransactionsBatch(
    client.rpc,
    signatures.map((s) => s.signature)
  );

  if (transactions.length === 0) {
    console.log("No transactions found");
    return;
  }

  transactions.forEach((tx, index) => {
    tx.protocol = detectProtocol(tx.programIds);

    const date = tx.blockTime
      ? new Date(Number(tx.blockTime) * 1000).toLocaleString()
      : "Pending";
    const status = tx.err ? "Failed" : "Success";
    const protocolName = tx.protocol ? tx.protocol.name : "Unknown";

    console.log(`\n${index + 1}. ${tx.signature}`);
    console.log(`   Status: ${status}`);
    console.log(`   Protocol: ${protocolName}`);
    console.log(`   Time: ${date}`);

    const solChange = getWalletSolChange(tx, WALLET_ADDRESS);
    const tokenChanges = getWalletTokenChanges(tx, WALLET_ADDRESS, [
      ...TRACKED_TOKENS,
    ]);

    if (solChange || tokenChanges.length > 0) {
      console.log(`   Balance Changes:`);

      if (solChange) {
        const sign = solChange.changeUi > 0 ? "+" : "";
        console.log(`     SOL: ${sign}${solChange.changeUi.toFixed(9)}`);
      }

      for (const change of tokenChanges) {
        const sign = change.change.ui > 0 ? "+" : "";
        console.log(
          `     ${change.tokenInfo.symbol}: ${sign}${change.change.ui.toFixed(
            change.tokenInfo.decimals
          )}`
        );
      }
    } else {
      console.log(`   Balance Changes: None`);
    }
  });

  console.log("\n============================================");
}

main().catch(console.error);
