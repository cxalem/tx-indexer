import { createIndexer } from "tx-indexer";

const SIG = "4cu2aBEviivATT9mQbu7xEjaDaGokKk3phGmcqMT3X9v5nUmPLjvCmtU4oTSeWYhGmc1ShSQEjykgvGVq81TBxsF";
const indexer = createIndexer({ rpcUrl: process.env.RPC_URL || "https://api.mainnet-beta.solana.com" });

const tx = await indexer.getTransaction(SIG);
if (!tx) { console.log("not found"); process.exit(1); }

console.log("=== Classification ===");
console.log("type:", tx.classification.primaryType);
console.log("protocol:", tx.classification.protocol);
console.log("sender:", tx.classification.sender);
console.log("receiver:", tx.classification.receiver);
console.log("primary:", tx.classification.primaryAmount);
console.log("secondary:", tx.classification.secondaryAmount);
console.log("metadata:", tx.classification.metadata);

console.log("\n=== Raw tx shape ===");
const raw: any = (tx as any).raw ?? (tx as any).transaction ?? null;
if (raw) {
  const msg = raw.transaction?.message ?? raw.message;
  console.log("signatures count:", raw.transaction?.signatures?.length ?? raw.signatures?.length);
  console.log("signers (numRequiredSignatures):", msg?.header?.numRequiredSignatures);
  console.log("account keys:", msg?.accountKeys?.length ?? msg?.staticAccountKeys?.length);
  console.log("instructions:", (msg?.instructions ?? msg?.compiledInstructions)?.length);
  const loaded = raw.meta?.loadedAddresses;
  if (loaded) console.log("LUT addresses — writable:", loaded.writable?.length, "readonly:", loaded.readonly?.length);
  console.log("inner ix groups:", raw.meta?.innerInstructions?.length);
  const innerCount = (raw.meta?.innerInstructions ?? []).reduce((a: number, g: any) => a + (g.instructions?.length ?? 0), 0);
  console.log("total inner ix:", innerCount);
}
