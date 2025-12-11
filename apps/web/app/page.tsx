import { TransactionReceipt } from "@/components/tx-receipt";
import { createIndexer } from "tx-indexer";

export default async function Page() {
  const { getTransaction } = createIndexer({
    rpcUrl:
      "https://mainnet.helius-rpc.com/?api-key=5936078f-0f2f-42d4-80a6-80e8b848da9b",
  });

  const transaction = await getTransaction(
    "4cu2aBEviivATT9mQbu7xEjaDaGokKk3phGmcqMT3X9v5nUmPLjvCmtU4oTSeWYhGmc1ShSQEjykgvGVq81TBxsF",
    "Hb6dzd4pYxmFYKkJDWuhzBEUkkaE93sFcvXYtriTkmw9"
  );

  return (
    <div className="w-full h-full">
      <TransactionReceipt transaction={transaction!} />
    </div>
  );
}
