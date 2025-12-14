import { ImageResponse } from "next/og";
import { indexer } from "@/lib/indexer";
import { signature } from "@solana/kit";
import { formatDate } from "@/lib/utils";

export const runtime = "edge";
export const alt = "Transaction Details";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

function formatAmount(amount: number, symbol: string) {
  const stablecoins = ["USDC", "USDT", "USDH", "PAI", "UXD", "EURC", "USDG"];
  const isStablecoin = stablecoins.includes(symbol.toUpperCase());
  return isStablecoin ? amount.toFixed(2) : amount.toFixed(4);
}

export default async function Image({
  params,
}: {
  params: Promise<{ sig: string }>;
}) {
  const { sig } = await params;

  try {
    const transaction = await indexer.getTransaction(signature(sig));

    if (!transaction) {
      return new ImageResponse(
        (
          <div
            style={{
              height: "100%",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
              fontSize: 32,
              fontWeight: 600,
            }}
          >
            <div style={{ marginBottom: 20 }}>Transaction Not Found</div>
          </div>
        ),
        { ...size }
      );
    }

    const { tx, classification } = transaction;
    const isSuccess = !tx.err;
    const primaryAmount = classification.primaryAmount;
    const secondaryAmount = classification.secondaryAmount;

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fafafa",
            padding: "60px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#fff",
              borderRadius: "24px",
              border: "2px solid #e5e5e5",
              padding: "48px",
              width: "100%",
              maxWidth: "1000px",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "32px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div
                  style={{
                    fontSize: "48px",
                    fontWeight: "bold",
                    color: "#262626",
                    textTransform: "capitalize",
                  }}
                >
                  {classification.primaryType.replace("_", " ")}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: isSuccess ? "#16a34a" : "#dc2626",
                  }}
                />
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "600",
                    color: isSuccess ? "#16a34a" : "#dc2626",
                  }}
                >
                  {isSuccess ? "Success" : "Failed"}
                </div>
              </div>
            </div>

            {/* Direction */}
            <div
              style={{
                display: "flex",
                fontSize: "20px",
                color: "#737373",
                textTransform: "capitalize",
                marginBottom: "32px",
              }}
            >
              {classification.direction}
            </div>

            {/* Amounts */}
            {primaryAmount && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  marginBottom: "32px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: "42px",
                    fontWeight: "700",
                    color: "#171717",
                  }}
                >
                  {formatAmount(primaryAmount.amountUi, primaryAmount.token.symbol)}{" "}
                  {primaryAmount.token.symbol}
                </div>
                {secondaryAmount && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      fontSize: "32px",
                      color: "#525252",
                    }}
                  >
                    <span>→</span>
                    <span>
                      {formatAmount(secondaryAmount.amountUi, secondaryAmount.token.symbol)}{" "}
                      {secondaryAmount.token.symbol}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Protocol */}
            {tx.protocol && (
              <div
                style={{
                  display: "flex",
                  fontSize: "20px",
                  color: "#737373",
                  marginBottom: "24px",
                }}
              >
                Via: {tx.protocol.name}
              </div>
            )}

            {/* Date */}
            <div
              style={{
                display: "flex",
                paddingTop: "24px",
                borderTop: "1px solid #e5e5e5",
                fontSize: "18px",
                color: "#a3a3a3",
              }}
            >
              {formatDate(tx.blockTime)}
            </div>
          </div>

          {/* Footer branding */}
          <div
            style={{
              display: "flex",
              marginTop: "32px",
              fontSize: "24px",
              color: "#737373",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontWeight: "bold", color: "#171717" }}>itx</span>
            <span style={{ color: "#ef4444" }}>//</span>
            <span>transaction indexer</span>
          </div>
        </div>
      ),
      { ...size }
    );
  } catch (error) {
    console.error("Error generating OG image:", error);
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            fontSize: 32,
            fontWeight: 600,
          }}
        >
          <div>Error Loading Transaction</div>
        </div>
      ),
      { ...size }
    );
  }
}

