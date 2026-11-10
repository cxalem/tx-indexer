# Recorded mainnet fixtures

Captured once, on 2026-11-10 (~17:55 UTC), from the public endpoint
`https://api.mainnet-beta.solana.com` (no API key) with:

```
getTransaction(<signature>, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "finalized" })
```

Candidates came from `getSignaturesForAddress("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", { limit: 20 })`;
kept: successful v0 transactions whose `meta.loadedAddresses.writable` is non-empty and whose
lamport balance changes at an index >= the static key count.

Each file is `{ "_meta": {...}, "response": <verbatim JSON-RPC body> }`. The body is stored
byte-for-byte so integers are exact. Tests replay it through a real `@solana/kit` RPC with a
mocked transport (`../fixture-rpc.ts`); nothing touches the network.

Note (review round 2): every lookup-table account whose lamports change in these
three swaps is an existing wSOL token account (pre and post native-mint entries). The
mapper represents a wSOL account ONCE, by its actual lamport delta attributed to the
token owner from the balance metadata; the token-amount change is not emitted. Here the
lamport delta equals the token delta (no account is created), so the amounts match the
token balances exactly. The "expected SOL legs" list that
owner-attributed lamport leg. In these tests `protocol` is null, so owners are tagged
`external:`; through the SDK (protocol = jupiter) the same leg is tagged
`protocol:jupiter:SOL:<owner>`.

Index layout: `[static keys][loadedAddresses.writable][loadedAddresses.readonly]`.
"ALT-w" = loaded from a lookup table as writable.

## jupiter-swap-sol-to-token.json

- Signature `2RvHqAyiYRzM3L2LjdDBW3b4MNzihZXd6fNDzR3Emx4TbguzJ9YJRNgoztn6ZunCJwWPoy1NzjqnEFhtpaqaQzow`
- Slot 467812185, version 0, 9 static + 3 writable + 5 readonly = 17 keys, `meta.fee` 5039
- Lamport changes (pre -> post):
  - [0] static `EMgSdxvQ...` (fee payer): 3686635285 -> 3682487402, **-4147883**
  - [10] ALT-w `C47dRtoz...` (wSOL pool vault): 135692492640 -> 135696635484, **+4142844**
- Check: 4147883 - 4142844 = 5039 = `meta.fee`. Balanced.
- Expected SOL legs: fee payer debit 4147883 (sent), `fee:network` credit 5039; the vault's
  lamport delta +4142844 appears once, attributed to its owner `HLnpSz9h...`. Token legs (unchanged by this fix): fee payer +1994890919495 FUSE,
  pool authority `HLnpSz9h...` +4142844 wSOL and -1994890919495 FUSE.
- Old mapping (static keys only): vault credit dropped, fee leg 4147883 (inflated 823x).

## jupiter-swap-token-to-sol.json

- Signature `4AkHKXZmgfsgWyBpWp5ZXwL6GEjttQoyDtnt3oqaECxoQq7Cv6jXN7kfPxZstcWCSbJBDVd9KX8WioDcwKMinuEg`
- Slot 467812184, version 0, 9 static + 3 writable + 3 readonly = 15 keys, `meta.fee` 5000
- Lamport changes:
  - [0] static `6bAWX3qm...` (fee payer): 189171610 -> 211408972, **+22237362**
  - [9] ALT-w `3QjuKNVi...` (wSOL pool vault): 714106159968 -> 714083917606, **-22242362**
- Check: 22242362 - 22237362 = 5000 = `meta.fee`. Balanced. This is the transfer-like case:
  lamports leave a lookup-table writable account and arrive at the signer.
- Expected SOL legs: fee payer credit 22237362 (received), `fee:network` credit 5000; the vault's
  lamport delta -22242362 appears once, attributed to pool authority `5Q544fKr...`.
- Old mapping: vault debit dropped, residual negative, so **no fee leg at all**.

## jupiter-swap-with-alt-fee-account.json

- Signature `2gUmqJkWcz5EUCzaLTuAxHYBU4Ty4ErxEb699HSTn2wWfStomuemUoWmvtkn3ERJQF93dcNi1Nik9BKybJJEWTPk`
- Slot 467812184, version 0, 10 static + 4 writable + 7 readonly = 21 keys, `meta.fee` 205000
- Lamport changes:
  - [0] static `HyotTjJE...` (fee payer): 192400000 -> 9795000, **-182605000**
  - [11] ALT-w `8Tyqob7o...` (wSOL pool vault): +182354941
  - [12] ALT-w `CASRL2zk...` (wSOL fee account): +45059
- Check: 182605000 - 182354941 - 45059 = 205000 = `meta.fee`. Balanced.
- Expected SOL legs: fee payer debit 182605000, `fee:network` credit 205000; the two ALT-w lamport
  credits appear once each, attributed to owners `3mxDjdZ1...` (+182354941) and `5eHhjP8J...` (+45059).
- Old mapping: both credits dropped, fee leg 182605000 (inflated ~890x).

## unsupported-version-synthetic-v2-error.json (synthetic)

- Not captured. Replaces the recorded `unsupported-version-v1-error.json` (a real -32015 for a
  v1 transaction requested with max version 0), which stopped describing reality once the SDK
  started requesting `maxSupportedTransactionVersion: 1`: the same request now returns the
  transaction.
- Body: `{"code":-32015,"message":"Transaction version (2) is not supported by the requesting client. ..."}`,
  the recorded wording with both version numbers raised by one. No version 2 exists on any
  cluster; this exercises the typed `UnsupportedTransactionVersionError` path for versions above
  the supported one. Signature: 64 bytes of `0x02`, base58-encoded.

# Recorded version 1 fixtures

Captured once, on 2026-11-10 (21:11:46 UTC), from `https://api.mainnet-beta.solana.com`
(no API key, 2 s between calls) with:

```
getTransaction(<signature>, { encoding: "json", maxSupportedTransactionVersion: 1, commitment: "finalized" })
```

Candidates came from `getSignaturesForAddress("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", { limit: 20, commitment: "finalized" })`;
14 of the 20 were successful. Walking them in order, the first six fetched were 2 x v0 and 4 x v1;
three of the v1 ones are kept (the fourth, `4fE9NY6V...`, goes through the same program as
`v1-swap-sol-to-token.json`).

Shape compared with v0 (same `encoding: "json"` response): `version: 1`; the message has no
`addressTableLookups` and a new `transactionConfig` object (`computeUnitLimit`, `heapSize`,
`loadedAccountsDataSizeLimit`, `priorityFee`) instead of compute-budget instructions;
`meta.loadedAddresses` is present and empty. Every account is a static key, so the resolved key
list is `transaction.message.accountKeys` and its length equals `meta.preBalances.length`. Nothing
else in the fields this SDK reads changed. In all three, `meta.fee` = 5000 x signatures +
`transactionConfig.priorityFee`.

## v1-jupiter-swap-token-to-token.json

- Signature `4qKaNNi5MokSHFS2ANVcPjodCzSJCbmcoySq31bTMmAjWDgWPQ419VZ5SgcLVsHZ7dc8EhBxioPptpHyVeeQnotn`
- Slot 467867094, version 1, 49 static keys, 2 signers (`Fni6bHeA...` fee payer, `sighWH8K...`),
  `meta.fee` 14200 = 2 x 5000 + priorityFee 4200
- Lamport changes:
  - [0] `Fni6bHeA...` (fee payer): **-14200**
  - [5] `6wWVbLeH...` (wSOL account): **-3685826317**
  - [13] `BdY9QB2X...` (wSOL account, owner `Em6RvzGX...`): **+3684912174**
  - [24] `GYH1Gae1...` (wSOL account, owner `5cjcW9wE...`): **+914143**
- Check: 3685826317 - 3684912174 - 914143 = 0; the fee payer's 14200 = `meta.fee`. Balanced.
- Fee payer's token changes: -100000000000 raw `DKYcjobF...` (6 dp: -100,000) and
  +119883098235 raw `8Xg89xT8...` (6 dp: +119,883.098235). Everything else moves between pool
  and route accounts (USDC, wSOL, `TTWofwAg...`). Instructions call Jupiter v6.
- Reading: the fee payer swapped 100,000 DKYc for 119,883.098235 8Xg8 on Jupiter. Expected
  classification: `swap`, primary = DKYc out, secondary = 8Xg8 in. The SDK agrees.

## v1-swap-sol-to-token.json

- Signature `4Kb2yFBTCiBjGpXSbizSvcBgg4v6XxVaykSqXSyQKcU4vtBy267PYkqXAjJ17WgUkzbs99jxhgWWrRbThXVEKysz`
- Slot 467867093, version 1, 38 static keys, 2 signers (`Dha7rX3G...` fee payer, `E9BzZER9...`),
  `meta.fee` 12971 = 2 x 5000 + priorityFee 2971. Programs: System, Associated Token,
  `6Vo3245e...` (not recognised by this SDK), Memo.
- Lamport changes:
  - [0] `Dha7rX3G...` (fee payer): **-313285060**
  - [2] `KfHbT5Jr...`: +1396169
  - [6] `3W1ynasy...` (the buyer's new `H3xKwSgb...` token account): +1513840
  - [7] `4TQLFNWK...`: +10000
  - [10] `9Jgp8Npq...` (wSOL account, owner `2AXXcN6o...`): +308863640
  - [14] `AzGtW6xz...`: +1488440
- Check: 313285060 - (1396169 + 1513840 + 10000 + 308863640 + 1488440) = 12971 = `meta.fee`. Balanced.
- Token changes: buyer `Dha7rX3G...` +7074185417628 raw `H3xKwSgb...` (6 dp: +7,074,185.417628),
  paid out by `HscovBe9...`; along the route `2AXXcN6o...` (which received the 308863640
  lamports of wSOL) pays 15647614 raw RAY, of which `HscovBe9...` gets 15574205 and `5YxQFdt3...`
  73409.
- Reading: the fee payer bought 7,074,185.417628 H3xK with about 0.3089 SOL, routed SOL -> RAY ->
  H3xK; the other lamport credits are new-account reserves and a 10,000-lamport payment (their
  purpose was not verified). Expected classification: `swap`. **The SDK currently says
  `transfer`** (from `HscovBe9...` to the buyer): the program is not recognised and the Memo call
  wins protocol detection. This is a classifier gap, not a v1 issue; the SDK test records it
  with `test.failing`.

## v1-jupiter-route-usdc-gain.json

- Signature `61BohiiwEJ6Hyn1y21A7RL1VLx9PXXTKjh6t5RY8P7J5XhntQNGP4kT1ihxtdbKXB8KrZ2sCcV6WwcXKus1LMYuG`
- Slot 467867093, version 1, 35 static keys, 1 signer `CGgMCsQ6...`, `meta.fee` 7559 = 5000 +
  priorityFee 2559. Programs: System, Jupiter v6.
- Lamport changes: only [0] `CGgMCsQ6...` (fee payer): **-7559** = `meta.fee`. Balanced.
- Token changes: the signer's USDC account +1857 raw (0.001857 USDC). Route: `3fUj4dDS...` pays
  70883578 USDC and receives 96055 WBTC (`3NZ9JMVB...`); `2vPjbPRn...` receives 70881721 USDC and
  pays 95927 cbBTC (`cbbtcf3a...`) to `5CUmy7rX...`; `DUJ6Gqqn...` pays 96055 WBTC. USDC: 70883578
  = 70881721 + 1857.
- Reading: a circular Jupiter route (USDC -> cbBTC -> WBTC -> USDC) in which the signer puts
  nothing in, pays the network fee and keeps 1857 raw USDC. The SDK classifies it as `swap`
  with USDC 1857 received, which matches the route, but reports the **network fee (7559
  lamports) as the swap input**; that part is a known classifier gap recorded with
  `test.failing`.
