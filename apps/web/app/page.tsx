import { address, signature } from "@solana/kit";
import { TransactionReceipt } from "@/components/tx-receipt";
import { createIndexer } from "tx-indexer";
import { InstallCommand } from "@/components/install-command";
import localFont from "next/font/local";

const TX_SIGNATURE = signature(
  "4cu2aBEviivATT9mQbu7xEjaDaGokKk3phGmcqMT3X9v5nUmPLjvCmtU4oTSeWYhGmc1ShSQEjykgvGVq81TBxsF"
);
const WALLET_ADDRESS = address("Hb6dzd4pYxmFYKkJDWuhzBEUkkaE93sFcvXYtriTkmw9");

const bitcountFont = localFont({
  src: "./fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

export default async function Page() {
  const { getTransaction } = createIndexer({
    rpcUrl: process.env.RPC_URL!,
  });

  const transaction = await getTransaction(TX_SIGNATURE, WALLET_ADDRESS);

  return (
    <div className={`w-full h-full`}>
      <div className="max-w-5xl mx-auto text-center md:text-left flex flex-col md:flex-row gap-5 md:items-end items-center justify-center my-20">
        <div className="flex flex-col max-w-lg gap-2">
          <div className="space-x-2">
            <span className="text-5xl font-bold">itx</span>
            <span
              className={`${bitcountFont.className} text-3xl text-neutral-600`}
            >
              {"//"} classify your transactions
            </span>
          </div>
          <InstallCommand />
        </div>

        <div className="max-w-md flex flex-col lowercase">
          <p className="font-bold text-neutral-700 leading-relaxed mb-4">
            A TypeScript SDK that transforms raw Solana transactions into
            human-readable financial data.
          </p>

          <p className="text-base leading-relaxed text-neutral-600">
            Automatically classifies swaps, transfers, and payments with
            protocol detection and confidence scoring. Lightweight, powered by
            @solana/kit v5.
          </p>
        </div>
      </div>
      {transaction && (
        <div className="relative flex flex-col items-center justify-center">
          <h2
            className={`${bitcountFont.className} text-center mx-auto text-3xl text-neutral-600 mb-10`}
          >
            <span className="text-vibrant-red">{"//"}</span> receipt
          </h2>
          <TransactionReceipt transaction={transaction} />
        </div>
      )}
    </div>
  );
}
