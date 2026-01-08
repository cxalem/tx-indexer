import { NextRequest, NextResponse } from "next/server";
import {
  JUPITER_CONFIG,
  isValidSolanaAddress,
  parseJupiterError,
} from "@/lib/jupiter";

const JUPITER_SWAP_URL = `${JUPITER_CONFIG.baseUrl}${JUPITER_CONFIG.endpoints.swap}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quoteResponse, userPublicKey } = body;

    // Validate required parameters
    if (!quoteResponse || !userPublicKey) {
      return NextResponse.json(
        { error: "Missing required parameters: quoteResponse, userPublicKey" },
        { status: 400 },
      );
    }

    // Validate user public key
    if (!isValidSolanaAddress(userPublicKey)) {
      return NextResponse.json(
        { error: "Invalid userPublicKey address format" },
        { status: 400 },
      );
    }

    // Basic validation of quote response structure
    if (
      !quoteResponse.inputMint ||
      !quoteResponse.outputMint ||
      !quoteResponse.inAmount ||
      !quoteResponse.outAmount
    ) {
      return NextResponse.json(
        { error: "Invalid quoteResponse structure" },
        { status: 400 },
      );
    }

    // Get API key from environment
    const apiKey = process.env.JUPITER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Jupiter API key not configured. Get one at https://portal.jup.ag",
        },
        { status: 500 },
      );
    }

    const response = await fetch(JUPITER_SWAP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            priorityLevel: "medium",
            maxLamports: JUPITER_CONFIG.maxPriorityFeeLamports,
            global: false,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorMessage = parseJupiterError(errorText);
      return NextResponse.json(
        {
          error: errorMessage || `Jupiter swap failed: ${response.status}`,
        },
        { status: response.status },
      );
    }

    const swapData = await response.json();

    if (!swapData.swapTransaction) {
      return NextResponse.json(
        { error: "Jupiter API did not return a swap transaction" },
        { status: 500 },
      );
    }

    return NextResponse.json(swapData);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to build swap transaction" },
      { status: 500 },
    );
  }
}
