import { createSolanaClient, parseSignature } from "@tx-indexer/solana/rpc/client";
import { fetchTransaction } from "@tx-indexer/solana/fetcher/transactions";
import { detectProtocol } from "@tx-indexer/classification/protocols/detector";
import { transactionToLegs } from "@tx-indexer/solana/mappers/transaction-to-legs";
import { validateLegsBalance } from "@tx-indexer/core/tx/leg-validation";
import { classifyTransaction } from "@tx-indexer/classification/engine/classification-service";

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const SIGNATURE = process.env.SIGNATURE;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;

async function main() {
  if (!SIGNATURE) {
    console.error("Error: SIGNATURE environment variable is required");
    console.error("Usage: SIGNATURE=<sig> WALLET_ADDRESS=<address> bun apps/indexer/classify-tx.ts");
    process.exit(1);
  }

  if (!WALLET_ADDRESS) {
    console.error("Error: WALLET_ADDRESS environment variable is required");
    console.error("Usage: SIGNATURE=<sig> WALLET_ADDRESS=<address> bun apps/indexer/classify-tx.ts");
    process.exit(1);
  }

  console.log("TX Classifier\n");
  console.log("============================================\n");

  const client = createSolanaClient(RPC_URL);

  console.log(`Fetching transaction: ${SIGNATURE.slice(0, 16)}...\n`);

  const tx = await fetchTransaction(client.rpc, parseSignature(SIGNATURE));

  if (!tx) {
    console.error("Transaction not found");
    process.exit(1);
  }

  tx.protocol = detectProtocol(tx.programIds);

  const date = tx.blockTime
    ? new Date(Number(tx.blockTime) * 1000).toLocaleString()
    : "Pending";
  const status = tx.err ? "Failed" : "Success";
  const protocolName = tx.protocol ? tx.protocol.name : "Unknown";

  console.log("Transaction Details");
  console.log("--------------------------------------------");
  console.log(`Signature: ${tx.signature}`);
  console.log(`Status: ${status}`);
  console.log(`Protocol: ${protocolName}`);
  console.log(`Time: ${date}`);
  console.log(`Slot: ${tx.slot}`);
  console.log(`\nProgram IDs:\n  ${tx.programIds.join("\n  ")}`);

  if (tx.memo) {
    console.log(`\nMemo: ${tx.memo}`);
  }

  const legs = transactionToLegs(tx, WALLET_ADDRESS);
  const validation = validateLegsBalance(legs);
  const classification = classifyTransaction(legs, WALLET_ADDRESS, tx);

  console.log(`\n\nClassification`);
  console.log("--------------------------------------------");
  console.log(`Type: ${classification.primaryType}`);
  console.log(`Direction: ${classification.direction}`);
  if (classification.primaryAmount) {
    console.log(
      `Amount: ${classification.primaryAmount.amountUi.toFixed(
        classification.primaryAmount.token.decimals
      )} ${classification.primaryAmount.token.symbol}`
    );
  }
  if (classification.secondaryAmount) {
    console.log(
      `Received: ${classification.secondaryAmount.amountUi.toFixed(
        classification.secondaryAmount.token.decimals
      )} ${classification.secondaryAmount.token.symbol}`
    );
  }
  if (classification.counterparty) {
    console.log(`Counterparty: ${classification.counterparty.name}`);
    if (classification.counterparty.address) {
      console.log(
        `  Address: ${classification.counterparty.address.slice(0, 8)}...${classification.counterparty.address.slice(-8)}`
      );
    }
  }
  if (classification.metadata?.payment_type === "solana_pay") {
    console.log(`Payment Type: Solana Pay`);
    if (classification.metadata.memo) {
      console.log(`Payment Memo: ${classification.metadata.memo}`);
    }
    if (classification.metadata.merchant) {
      console.log(`Merchant: ${classification.metadata.merchant}`);
    }
    if (classification.metadata.item) {
      console.log(`Item: ${classification.metadata.item}`);
    }
    if (classification.metadata.label) {
      console.log(`Label: ${classification.metadata.label}`);
    }
    if (classification.metadata.message) {
      console.log(`Message: ${classification.metadata.message}`);
    }
  }
  console.log(`Confidence: ${classification.confidence}`);
  console.log(`Relevant: ${classification.isRelevant ? "Yes" : "No"}`);

  console.log(`\n\nTransaction Legs (${legs.length} total)`);
  console.log("--------------------------------------------");
  for (const leg of legs) {
    const sign = leg.side === "credit" ? "+" : "-";
    const amount = leg.amount.amountUi.toFixed(leg.amount.token.decimals);
    console.log(
      `${leg.role}: ${sign}${amount} ${leg.amount.token.symbol}`
    );
    console.log(`  Account: ${leg.accountId}`);
  }

  if (!validation.isBalanced) {
    console.log(`\nWARNING: Legs not balanced!`);
    for (const [token, balance] of Object.entries(validation.byToken)) {
      if (balance.diff > 0.000001) {
        console.log(
          `  ${token}: Debits=${balance.debits.toFixed(6)}, Credits=${balance.credits.toFixed(6)}, Diff=${balance.diff.toFixed(6)}`
        );
      }
    }
  } else {
    console.log(`\n✓ Legs are balanced`);
  }

  console.log("\n============================================");
}

main().catch(console.error);

