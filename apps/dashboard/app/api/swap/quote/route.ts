import { NextRequest, NextResponse } from "next/server";
import { isValidSwapPair } from "@/lib/swap-tokens";
import {
  JUPITER_CONFIG,
  isValidSolanaAddress,
  isValidSwapAmount,
  parseJupiterError,
} from "@/lib/jupiter";

const JUPITER_QUOTE_URL = `${JUPITER_CONFIG.baseUrl}${JUPITER_CONFIG.endpoints.quote}`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const inputMint = searchParams.get("inputMint");
  const outputMint = searchParams.get("outputMint");
  const amount = searchParams.get("amount");

  // Validate required parameters
  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: "Missing required parameters: inputMint, outputMint, amount" },
      { status: 400 },
    );
  }

  // Validate mint addresses
  if (!isValidSolanaAddress(inputMint)) {
    return NextResponse.json(
      { error: "Invalid inputMint address format" },
      { status: 400 },
    );
  }

  if (!isValidSolanaAddress(outputMint)) {
    return NextResponse.json(
      { error: "Invalid outputMint address format" },
      { status: 400 },
    );
  }

  // Validate amount
  if (!isValidSwapAmount(amount)) {
    return NextResponse.json(
      { error: "Invalid amount: must be a positive integer" },
      { status: 400 },
    );
  }

  // Validate swap pair
  if (!isValidSwapPair(inputMint, outputMint)) {
    return NextResponse.json({ error: "Invalid swap pair" }, { status: 400 });
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

  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: JUPITER_CONFIG.defaultSlippageBps.toString(),
    });

    const url = `${JUPITER_QUOTE_URL}?${params}`;

    const response = await fetch(url, {
      headers: {
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorMessage = parseJupiterError(errorText);
      return NextResponse.json(
        { error: errorMessage || `Jupiter quote failed: ${response.status}` },
        { status: response.status },
      );
    }

    const quoteResponse = await response.json();
    return NextResponse.json(quoteResponse);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch quote from Jupiter" },
      { status: 500 },
    );
  }
}
