import { describe, test, expect, mock, afterEach } from "bun:test";
import { fetchNftMetadata, fetchNftMetadataBatch } from "./nft";

const MOCK_RPC_URL = "https://mock-rpc.example.com";
const MOCK_MINT_ADDRESS = "EurDi2E2tLoeHXLbBwKmESBba72kw63eGqy8MLB5SdVq";

interface MockDasResult {
  id: string;
  content: {
    metadata: {
      name: string;
      symbol: string;
      description?: string;
      attributes?: Array<{ trait_type: string; value: string }>;
    };
    links: { image?: string };
    files?: Array<{ uri: string; cdn_uri?: string; mime: string }>;
  };
  grouping?: Array<{ group_key: string; group_value: string }>;
}

interface MockDasResponse {
  jsonrpc: string;
  result?: MockDasResult;
  error?: { code: number; message: string };
}

function createMockDasResponse(
  resultOverrides?: Partial<MockDasResult>,
): MockDasResponse {
  const defaultResult: MockDasResult = {
    id: MOCK_MINT_ADDRESS,
    content: {
      metadata: {
        name: "Mad Lad #9971",
        symbol: "MAD",
        description: "Fock it.",
        attributes: [
          { trait_type: "Background", value: "Blue" },
          { trait_type: "Eyes", value: "Laser" },
        ],
      },
      links: {
        image: "https://madlads.s3.us-west-2.amazonaws.com/images/9971.png",
      },
      files: [
        {
          uri: "https://madlads.s3.us-west-2.amazonaws.com/images/9971.png",
          cdn_uri: "https://cdn.helius-rpc.com/cdn-cgi/image/9971.png",
          mime: "image/png",
        },
      ],
    },
    grouping: [
      {
        group_key: "collection",
        group_value: "J1S9H3QjnRtBbbuD4HjPV6RpRhwuk4zKbxsnCHuTgh9w",
      },
    ],
  };

  return {
    jsonrpc: "2.0",
    result: resultOverrides
      ? { ...defaultResult, ...resultOverrides }
      : defaultResult,
  };
}

function createMockFetch(
  responseOrFn:
    | MockDasResponse
    | ((url: string, options: RequestInit) => MockDasResponse),
) {
  return mock((url: string, options: RequestInit) => {
    const response =
      typeof responseOrFn === "function"
        ? responseOrFn(url, options)
        : responseOrFn;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(response),
    } as Response);
  }) as unknown as typeof fetch;
}

describe("fetchNftMetadata", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("should fetch and parse NFT metadata successfully", async () => {
    global.fetch = createMockFetch(createMockDasResponse());

    const result = await fetchNftMetadata(MOCK_RPC_URL, MOCK_MINT_ADDRESS);

    expect(result).not.toBeNull();
    expect(result?.mint).toBe(MOCK_MINT_ADDRESS);
    expect(result?.name).toBe("Mad Lad #9971");
    expect(result?.symbol).toBe("MAD");
    expect(result?.image).toBe(
      "https://madlads.s3.us-west-2.amazonaws.com/images/9971.png",
    );
    expect(result?.cdnImage).toBe(
      "https://cdn.helius-rpc.com/cdn-cgi/image/9971.png",
    );
    expect(result?.description).toBe("Fock it.");
    expect(result?.collection).toBe(
      "J1S9H3QjnRtBbbuD4HjPV6RpRhwuk4zKbxsnCHuTgh9w",
    );
    expect(result?.attributes).toHaveLength(2);
    expect(result?.attributes?.[0]).toEqual({
      trait_type: "Background",
      value: "Blue",
    });
  });

  test("should return null when API returns an error", async () => {
    const errorResponse: MockDasResponse = {
      jsonrpc: "2.0",
      error: { code: -32600, message: "Invalid Request" },
    };
    global.fetch = createMockFetch(errorResponse);

    const result = await fetchNftMetadata(MOCK_RPC_URL, MOCK_MINT_ADDRESS);

    expect(result).toBeNull();
  });

  test("should return null when result is missing", async () => {
    const noResultResponse: MockDasResponse = { jsonrpc: "2.0" };
    global.fetch = createMockFetch(noResultResponse);

    const result = await fetchNftMetadata(MOCK_RPC_URL, MOCK_MINT_ADDRESS);

    expect(result).toBeNull();
  });

  test("should return null when metadata is missing", async () => {
    const noMetadataResponse: MockDasResponse = {
      jsonrpc: "2.0",
      result: {
        id: MOCK_MINT_ADDRESS,
        content: {
          metadata:
            undefined as unknown as MockDasResult["content"]["metadata"],
          links: {},
        },
      },
    };
    global.fetch = createMockFetch(noMetadataResponse);

    const result = await fetchNftMetadata(MOCK_RPC_URL, MOCK_MINT_ADDRESS);

    expect(result).toBeNull();
  });

  test("should use image from links when available", async () => {
    global.fetch = createMockFetch(createMockDasResponse());

    const result = await fetchNftMetadata(MOCK_RPC_URL, MOCK_MINT_ADDRESS);

    expect(result?.image).toBe(
      "https://madlads.s3.us-west-2.amazonaws.com/images/9971.png",
    );
  });

  test("should fallback to files uri when links.image is missing", async () => {
    global.fetch = createMockFetch(
      createMockDasResponse({
        content: {
          metadata: { name: "Mad Lad #9971", symbol: "MAD" },
          links: {},
          files: [
            {
              uri: "https://madlads.s3.us-west-2.amazonaws.com/images/9971.png",
              cdn_uri: "https://cdn.helius-rpc.com/cdn-cgi/image/9971.png",
              mime: "image/png",
            },
          ],
        },
      }),
    );

    const result = await fetchNftMetadata(MOCK_RPC_URL, MOCK_MINT_ADDRESS);

    expect(result?.image).toBe(
      "https://madlads.s3.us-west-2.amazonaws.com/images/9971.png",
    );
  });

  test("should handle missing grouping (no collection)", async () => {
    global.fetch = createMockFetch(
      createMockDasResponse({ grouping: undefined }),
    );

    const result = await fetchNftMetadata(MOCK_RPC_URL, MOCK_MINT_ADDRESS);

    expect(result).not.toBeNull();
    expect(result?.collection).toBeUndefined();
  });

  test("should send correct RPC request", async () => {
    const capturedRequest: { url: string; body: Record<string, unknown> }[] =
      [];

    global.fetch = mock((url: string, options: RequestInit) => {
      capturedRequest.push({ url, body: JSON.parse(options.body as string) });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockDasResponse()),
      } as Response);
    }) as unknown as typeof fetch;

    await fetchNftMetadata(MOCK_RPC_URL, MOCK_MINT_ADDRESS);

    expect(capturedRequest[0]?.url).toBe(MOCK_RPC_URL);
    expect(capturedRequest[0]?.body.method).toBe("getAsset");
    expect(capturedRequest[0]?.body.params).toEqual({ id: MOCK_MINT_ADDRESS });
    expect(capturedRequest[0]?.body.jsonrpc).toBe("2.0");
  });
});

describe("fetchNftMetadataBatch", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("should fetch multiple NFTs in parallel", async () => {
    const mint1 = "MINT_ADDRESS_1";
    const mint2 = "MINT_ADDRESS_2";
    const mint3 = "MINT_ADDRESS_3";

    let callCount = 0;
    global.fetch = createMockFetch((url, options) => {
      callCount++;
      const body = JSON.parse(options.body as string);
      const mintAddress = body.params.id as string;
      return createMockDasResponse({
        id: mintAddress,
        content: {
          metadata: { name: `NFT ${mintAddress}`, symbol: "NFT" },
          links: { image: "https://example.com/image.png" },
        },
      });
    });

    const result = await fetchNftMetadataBatch(MOCK_RPC_URL, [
      mint1,
      mint2,
      mint3,
    ]);

    expect(callCount).toBe(3);
    expect(result.size).toBe(3);
    expect(result.get(mint1)?.name).toBe(`NFT ${mint1}`);
    expect(result.get(mint2)?.name).toBe(`NFT ${mint2}`);
    expect(result.get(mint3)?.name).toBe(`NFT ${mint3}`);
  });

  test("should only include successful fetches in result map", async () => {
    const mint1 = "MINT_SUCCESS";
    const mint2 = "MINT_FAIL";

    global.fetch = mock((url: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      const mintAddress = body.params.id as string;

      if (mintAddress === "MINT_FAIL") {
        const errorResponse: MockDasResponse = {
          jsonrpc: "2.0",
          error: { code: -1, message: "Not found" },
        };
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(errorResponse),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            createMockDasResponse({
              id: mintAddress,
              content: {
                metadata: { name: "Success NFT", symbol: "NFT" },
                links: { image: "https://example.com/image.png" },
              },
            }),
          ),
      } as Response);
    }) as unknown as typeof fetch;

    const result = await fetchNftMetadataBatch(MOCK_RPC_URL, [mint1, mint2]);

    expect(result.size).toBe(1);
    expect(result.has(mint1)).toBe(true);
    expect(result.has(mint2)).toBe(false);
  });

  test("should continue batch when one fetch throws", async () => {
    const mint1 = "MINT_SUCCESS";
    const mint2 = "MINT_THROW";

    global.fetch = mock((url: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      const mintAddress = body.params.id as string;

      if (mintAddress === mint2) {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            createMockDasResponse({
              id: mintAddress,
              content: {
                metadata: { name: "Success NFT", symbol: "NFT" },
                links: { image: "https://example.com/image.png" },
              },
            }),
          ),
      } as Response);
    }) as unknown as typeof fetch;

    const result = await fetchNftMetadataBatch(MOCK_RPC_URL, [mint1, mint2]);

    expect(result.size).toBe(1);
    expect(result.has(mint1)).toBe(true);
    expect(result.has(mint2)).toBe(false);
  });

  test("should return empty map for empty input", async () => {
    global.fetch = mock(() => {
      throw new Error("Should not be called");
    }) as unknown as typeof fetch;

    const result = await fetchNftMetadataBatch(MOCK_RPC_URL, []);

    expect(result.size).toBe(0);
  });
});
