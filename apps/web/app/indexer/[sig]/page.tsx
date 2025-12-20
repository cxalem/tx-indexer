import { indexer } from "@/lib/indexer";
import { getSolPrice } from "@/lib/sol-price";
import { signature } from "@solana/kit";
import { TransactionSummary } from "@/components/transaction/transaction-summary";
import { TransactionReceiptSection } from "@/components/transaction/transaction-receipt-section";
import { TransactionTechnical } from "@/components/transaction/transaction-technical";
import { TransactionLinks } from "@/components/transaction/transaction-links";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sig: string }>;
}): Promise<Metadata> {
  const { sig } = await params;

  try {
    const transaction = await indexer.getTransaction(signature(sig));

    if (!transaction) {
      return {
        title: "Transaction Not Found",
        description:
          "The transaction you're looking for doesn't exist or hasn't been indexed yet.",
      };
    }

    const { classification } = transaction;
    const primaryAmount = classification.primaryAmount;
    const secondaryAmount = classification.secondaryAmount;

    let description = `${classification.primaryType.replace("_", " ")} transaction`;
    if (primaryAmount) {
      description = `${primaryAmount.amountUi.toLocaleString()} ${primaryAmount.token.symbol}`;
      if (classification.primaryType === "swap" && secondaryAmount) {
        description += ` → ${secondaryAmount.amountUi.toLocaleString()} ${secondaryAmount.token.symbol}`;
      }
    }

    return {
      title: `${classification.primaryType.replace("_", " ")} | itx`,
      description,
      openGraph: {
        title: `${classification.primaryType.replace("_", " ")} Transaction`,
        description,
        type: "website",
        images: [
          {
            url: `/indexer/${sig}/opengraph-image`,
            width: 1200,
            height: 630,
            alt: "Transaction Details",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${classification.primaryType.replace("_", " ")} Transaction`,
        description,
        images: [`/indexer/${sig}/opengraph-image`],
        creator: "@cxalem",
        site: "@cxalem",
      },
    };
  } catch {
    return {
      title: "Transaction | itx",
      description: "View transaction details",
    };
  }
}

export default async function TransactionPage({
  params,
}: {
  params: Promise<{ sig: string }>;
}) {
  const { sig } = await params;

  const [transaction, solPrice] = await Promise.all([
    indexer.getTransaction(signature(sig)),
    getSolPrice(),
  ]);

  if (!transaction) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="border border-neutral-200 rounded-lg bg-white p-8 text-center">
          <h1 className="text-2xl font-semibold text-neutral-900 mb-2">
            Transaction Not Found
          </h1>
          <p className="text-neutral-600 mb-6">
            The transaction you&apos;re looking for doesn&apos;t exist or
            hasn&apos;t been indexed yet.
          </p>
          <Link
            href="/indexer"
            className="inline-flex items-center gap-2 text-vibrant-red hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Transactions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/indexer"
        className="inline-flex items-center gap-2 text-neutral-600 hover:text-vibrant-red transition-colors mb-6"
        data-print-hide
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Transactions
      </Link>

      <div className="space-y-6">
        <div data-print-hide>
          <TransactionSummary transaction={transaction} />
        </div>
        <TransactionReceiptSection
          transaction={transaction}
          solPrice={solPrice}
        />
        <div data-print-hide>
          <TransactionTechnical transaction={transaction} />
        </div>
        <div data-print-hide>
          <TransactionLinks signature={transaction.tx.signature} />
        </div>
      </div>
    </div>
  );
}
