/**
 * Mock transaction data for showcasing the tx-indexer capabilities
 */

// Mock transaction data showcasing different transaction types
export const mockTransactions = [
  // 1. Solana Pay Payment
  {
    tx: {
      signature: "5k9XPH7FKz2mN8Qx3vP7eR2sJ9mK4nL6wY8hT3xV2pQ1zA4bC9dE5fG6hI7jK8lM9nO0pQ1rS2tU3vW4xY5zA6b",
      slot: 234567890n,
      blockTime: 1702345678n,
      err: null,
      programIds: ["11111111111111111111111111111111", "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
      protocol: {
        id: "solana-pay",
        name: "Solana Pay",
        iconUrl: "https://solanapay.com/icon.png",
      },
      memo: "Solana Pay | merchant=Coffee Shop | item=Latte",
    },
    classification: {
      primaryType: "transfer" as const,
      direction: "outgoing" as const,
      primaryAmount: {
        token: {
          mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
        },
        amountRaw: "4500000",
        amountUi: 4.5,
      },
      secondaryAmount: null,
      counterparty: {
        type: "merchant" as const,
        address: "",
        name: "Coffee Shop",
      },
      confidence: 0.98,
      isRelevant: true,
      metadata: {
        payment_type: "solana_pay",
        merchant: "Coffee Shop",
        item: "Latte",
        memo: "Solana Pay | merchant=Coffee Shop | item=Latte",
      },
    },
    legs: [],
  },

  // 2. PayAI Facilitated Transfer
  {
    tx: {
      signature: "3mN8pQ1rS2tU3vW4xY5zA6b7cD8eF9gH1iJ2kL3mN4oP5qR6sT7uV8wX9yZ1aB2cD3eF4gH5iJ6kL7mN8oP9qR0",
      slot: 234567850n,
      blockTime: 1702345620n,
      err: null,
      programIds: ["11111111111111111111111111111111", "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4"],
      protocol: null,
      memo: "x402 payment",
    },
    classification: {
      primaryType: "transfer" as const,
      direction: "outgoing" as const,
      primaryAmount: {
        token: {
          mint: "So11111111111111111111111111111111111111112",
          symbol: "SOL",
          name: "Solana",
          decimals: 9,
        },
        amountRaw: "150000000",
        amountUi: 0.15,
      },
      secondaryAmount: null,
      counterparty: {
        type: "unknown" as const,
        address: "9pQqT7uV8wX9yZ1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT",
        name: "9pQqT7uV...",
      },
      confidence: 0.95,
      isRelevant: true,
      metadata: {
        facilitator: "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4",
        payment_type: "facilitated",
      },
    },
    legs: [],
  },

  // 3. Token Swap (SOL → USDC)
  {
    tx: {
      signature: "7xY5zA6b7cD8eF9gH1iJ2kL3mN4oP5qR6sT7uV8wX9yZ1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4aB5",
      slot: 234567800n,
      blockTime: 1702345500n,
      err: null,
      programIds: ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
      protocol: {
        id: "jupiter",
        name: "Jupiter",
        iconUrl: "https://jup.ag/icon.png",
      },
      memo: null,
    },
    classification: {
      primaryType: "swap" as const,
      direction: "neutral" as const,
      primaryAmount: {
        token: {
          mint: "So11111111111111111111111111111111111111112",
          symbol: "SOL",
          name: "Solana",
          decimals: 9,
        },
        amountRaw: "500000000",
        amountUi: 0.5,
      },
      secondaryAmount: {
        token: {
          mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
        },
        amountRaw: "48250000",
        amountUi: 48.25,
      },
      counterparty: null,
      confidence: 0.9,
      isRelevant: true,
      metadata: {
        swap_type: "token_to_token",
        from_token: "SOL",
        to_token: "USDC",
        from_amount: 0.5,
        to_amount: 48.25,
      },
    },
    legs: [],
  },

  // 4. Incoming Transfer (USDC)
  {
    tx: {
      signature: "2kL3mN4oP5qR6sT7uV8wX9yZ1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4aB5cD6eF7gH8iJ9kL0mN1",
      slot: 234567750n,
      blockTime: 1702345400n,
      err: null,
      programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
      protocol: null,
      memo: "Thanks for the service! 🙏",
    },
    classification: {
      primaryType: "transfer" as const,
      direction: "incoming" as const,
      primaryAmount: {
        token: {
          mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
        },
        amountRaw: "75000000",
        amountUi: 75.0,
      },
      secondaryAmount: null,
      counterparty: {
        type: "person" as const,
        address: "4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4aB5cD6eF7gH8i",
        name: "4gH5iJ6k...",
      },
      confidence: 0.95,
      isRelevant: true,
      metadata: {
        memo: "Thanks for the service! 🙏",
      },
    },
    legs: [],
  },

  // 5. Token Airdrop
  {
    tx: {
      signature: "9qR0sT1uV2wX3yZ4aB5cD6eF7gH8iJ9kL0mN1oP2qR3sT4uV5wX6yZ7aB8cD9eF0gH1iJ2kL3mN4oP5qR6sT7",
      slot: 234567700n,
      blockTime: 1702345200n,
      err: null,
      programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
      protocol: {
        id: "unknown",
        name: "Unknown Protocol",
      },
      memo: null,
    },
    classification: {
      primaryType: "airdrop" as const,
      direction: "incoming" as const,
      primaryAmount: {
        token: {
          mint: "BonK1YhkXEGLZzwtcvRTip3gAL9nCeQD7ppZBLXhtTs",
          symbol: "BONK",
          name: "Bonk",
          decimals: 5,
        },
        amountRaw: "100000000",
        amountUi: 1000.0,
      },
      secondaryAmount: null,
      counterparty: {
        type: "protocol" as const,
        address: "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
        name: "DttWaMuV...",
      },
      confidence: 0.85,
      isRelevant: true,
      metadata: {
        airdrop_type: "token",
        token: "BONK",
        amount: 1000.0,
      },
    },
    legs: [],
  },

  // 6. Outgoing SOL Transfer
  {
    tx: {
      signature: "8wX6yZ7aB8cD9eF0gH1iJ2kL3mN4oP5qR6sT7uV8wX9yZ1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4",
      slot: 234567650n,
      blockTime: 1702345100n,
      err: null,
      programIds: ["11111111111111111111111111111111"],
      protocol: null,
      memo: null,
    },
    classification: {
      primaryType: "transfer" as const,
      direction: "outgoing" as const,
      primaryAmount: {
        token: {
          mint: "So11111111111111111111111111111111111111112",
          symbol: "SOL",
          name: "Solana",
          decimals: 9,
        },
        amountRaw: "2500000000",
        amountUi: 2.5,
      },
      secondaryAmount: null,
      counterparty: {
        type: "unknown" as const,
        address: "7mN8oP9qR0sT1uV2wX3yZ4aB5cD6eF7gH8iJ9kL0mN1o",
        name: "7mN8oP9q...",
      },
      confidence: 0.95,
      isRelevant: true,
      metadata: {},
    },
    legs: [],
  },

  // 7. Failed Transaction (for error state showcase)
  {
    tx: {
      signature: "1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4aB5cD6eF7gH8iJ9kL0mN1oP2qR3sT4uV5wX6yZ7aB8cD9",
      slot: 234567600n,
      blockTime: 1702345000n,
      err: { InstructionError: [1, "InsufficientFunds"] },
      programIds: ["11111111111111111111111111111111"],
      protocol: null,
      memo: null,
    },
    classification: {
      primaryType: "transfer" as const,
      direction: "outgoing" as const,
      primaryAmount: {
        token: {
          mint: "So11111111111111111111111111111111111111112",
          symbol: "SOL",
          name: "Solana",
          decimals: 9,
        },
        amountRaw: "10000000000",
        amountUi: 10.0,
      },
      secondaryAmount: null,
      counterparty: {
        type: "unknown" as const,
        address: "3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4aB5cD6eF7g",
        name: "3eF4gH5i...",
      },
      confidence: 0.95,
      isRelevant: false,
      metadata: {},
    },
    legs: [],
  },
];

// Summary stats for the showcase
export const mockWalletSummary = {
  totalTransactions: 7,
  successfulTransactions: 6,
  failedTransactions: 1,
  totalValueTransferred: {
    SOL: 3.15,
    USDC: 123.25,
  },
  transactionTypes: {
    transfer: 4,
    swap: 1,
    airdrop: 1,
    solana_pay: 1,
  },
};

// Mock wallet balance
export const mockWalletBalance = {
  sol: {
    token: {
      mint: "So11111111111111111111111111111111111111112",
      symbol: "SOL",
      name: "Solana",
      decimals: 9,
    },
    amount: {
      raw: "5420000000",
      ui: 5.42,
    },
  },
  tokens: [
    {
      token: {
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
      },
      amount: {
        raw: "123450000",
        ui: 123.45,
      },
    },
    {
      token: {
        mint: "BonK1YhkXEGLZzwtcvRTip3gAL9nCeQD7ppZBLXhtTs",
        symbol: "BONK",
        name: "Bonk",
        decimals: 5,
        logoURI: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
      },
      amount: {
        raw: "100000000",
        ui: 1000.0,
      },
    },
  ],
};

