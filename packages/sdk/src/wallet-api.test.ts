import { describe, test, expect, mock, afterEach } from "bun:test";
import { createIndexer } from "./client";
import {
  fetchWalletFundingSource,
  DEFAULT_HELIUS_WALLET_API_BASE_URL,
} from "./wallet-api";
import { ConfigurationError, RateLimitError } from "./errors";

const WALLET = "86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY";

function createFundingResponse() {
  return {
    funder: "26MAyPNpK4At8LgRECMMbgiKQuJyg3oACtw1Q9FRyuba",
    funderName: "Binance",
    funderType: "Centralized Exchange",
    mint: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    amount: 0.09811972,
    amountRaw: "98119720",
    decimals: 9,
    date: "2022-01-19T20:46:34.000Z",
    signature:
      "5WX9C5kCQNULGGrSHJBR1WDFyetVyekbUpe1KQ45p3zEBe6jVgSsJuMqLWijjTDcnaAK2518ZriktRMCNycnsNAG",
    timestamp: 1642625194,
    slot: 116984883,
    explorerUrl:
      "https://orbmarkets.io/tx/5WX9C5kCQNULGGrSHJBR1WDFyetVyekbUpe1KQ45p3zEBe6jVgSsJuMqLWijjTDcnaAK2518ZriktRMCNycnsNAG?tab=summary",
  };
}

describe("fetchWalletFundingSource", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("fetches and parses funded-by response", async () => {
    let requestedUrl = "";

    global.fetch = mock((url: string) => {
      requestedUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createFundingResponse()),
      } as Response);
    }) as unknown as typeof fetch;

    const result = await fetchWalletFundingSource({
      walletAddress: WALLET,
      apiKey: "test-key",
    });

    expect(result).not.toBeNull();
    expect(result?.funder).toBe("26MAyPNpK4At8LgRECMMbgiKQuJyg3oACtw1Q9FRyuba");
    expect(requestedUrl).toBe(
      `${DEFAULT_HELIUS_WALLET_API_BASE_URL}/wallet/${WALLET}/funded-by?api-key=test-key`,
    );
  });

  test("returns null on 404", async () => {
    global.fetch = mock(() => {
      return Promise.resolve({
        ok: false,
        status: 404,
      } as Response);
    }) as unknown as typeof fetch;

    const result = await fetchWalletFundingSource({
      walletAddress: WALLET,
      apiKey: "test-key",
    });

    expect(result).toBeNull();
  });

  test("maps 429 to RateLimitError", async () => {
    global.fetch = mock(() => {
      return Promise.resolve({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: () => Promise.resolve("rate limited"),
      } as Response);
    }) as unknown as typeof fetch;

    await expect(
      fetchWalletFundingSource({
        walletAddress: WALLET,
        apiKey: "test-key",
        retry: { maxAttempts: 1 },
      }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe("indexer.getWalletFundingSource", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("throws when no api key is configured", async () => {
    const indexer = createIndexer({ client: { rpc: {} as any } });

    await expect(indexer.getWalletFundingSource(WALLET)).rejects.toBeInstanceOf(
      ConfigurationError,
    );
  });

  test("uses indexer-level api key and caches successful responses", async () => {
    let fetchCalls = 0;

    global.fetch = mock(() => {
      fetchCalls++;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createFundingResponse()),
      } as Response);
    }) as unknown as typeof fetch;

    const indexer = createIndexer({
      client: { rpc: {} as any },
      heliusApiKey: "test-key",
      walletFundingCacheTtlMs: 60_000,
    });

    const a = await indexer.getWalletFundingSource(WALLET);
    const b = await indexer.getWalletFundingSource(WALLET);

    expect(a?.signature).toBeDefined();
    expect(b?.signature).toBe(a?.signature);
    expect(fetchCalls).toBe(1);
  });

  test("forceRefresh bypasses cache", async () => {
    let fetchCalls = 0;

    global.fetch = mock(() => {
      fetchCalls++;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createFundingResponse()),
      } as Response);
    }) as unknown as typeof fetch;

    const indexer = createIndexer({
      client: { rpc: {} as any },
      heliusApiKey: "test-key",
      walletFundingCacheTtlMs: 60_000,
    });

    await indexer.getWalletFundingSource(WALLET);
    await indexer.getWalletFundingSource(WALLET, { forceRefresh: true });

    expect(fetchCalls).toBe(2);
  });
});
