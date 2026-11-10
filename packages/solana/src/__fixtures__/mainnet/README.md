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

## unsupported-version-v1-error.json

- Signature `5qKSzfbM8GtbLeJifdfeLruiHoCJzNnA9UWBXG9ivaNC7JSbjMDkLFwQnpc2vZVGi89tKTznJuHvtY5rf72Umzs8`
  (a Jupiter transaction from the same signature page)
- Verbatim RPC rejection: `{"code":-32015,"message":"Transaction version (1) is not supported by the requesting client. ..."}`.
  Of the 15 successful signatures in the page, 8 were version 1 and were refused this way.
