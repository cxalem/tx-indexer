import { createSolanaClient, parseAddress } from "@solana/rpc/client";
import {
  fetchWalletSignatures,
  fetchTransactionsBatch,
} from "@solana/fetcher/transactions";
import { detectProtocol } from "@classification/protocols/detector";
import type { Signature } from "@solana/kit";

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;

async function main() {
  if (!WALLET_ADDRESS) {
    console.error("Error: WALLET_ADDRESS environment variable is required");
    console.error("Usage: WALLET_ADDRESS=<address> bun apps/indexer/index.ts");
    process.exit(1);
  }

  console.log("🚀 TX Indexer - Phase 3\n");
  console.log(`Wallet: ${WALLET_ADDRESS}`);
  console.log(`RPC: ${RPC_URL}\n`);

  const client = createSolanaClient(RPC_URL);
  const address = parseAddress(WALLET_ADDRESS);

  console.log("Fetching transaction signatures...\n");

  const signatures = await fetchWalletSignatures(client.rpc, address, {
    limit: 10,
  });

  console.log(
    `Fetching full transaction data for ${signatures.length} transactions...\n`
  );

  const transactions = await fetchTransactionsBatch(
    client.rpc,
    signatures.map((s) => s.signature)
  );

  transactions.forEach((tx) => {
    tx.protocol = detectProtocol(tx.programIds);
  });

  console.log(`Found ${transactions.length} transactions:\n`);

  transactions.forEach((tx, i: number) => {
    const date = tx.blockTime
      ? new Date(Number(tx.blockTime) * 1000).toLocaleString()
      : "Pending";
    const status = tx.err ? "❌ Failed" : "✅ Success";
    const protocolName = tx.protocol ? tx.protocol.name : "Unknown";

    console.log(`${i + 1}. ${tx.signature.slice(0, 16)}...`);
    console.log(`   Status: ${status}`);
    console.log(`   Protocol: ${protocolName}`);
    console.log(`   Time: ${date}`);
    console.log();
  });
}

main().catch(console.error);
