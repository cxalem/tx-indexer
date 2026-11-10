# Accuracy baseline changes

Every regeneration of `baseline.json` / `BASELINE.md` adds one entry here, in the same commit:
date, what changed, why. `bun run accuracy` fails if `baseline.json` changed without this file.

## 2026-11-10: independent review corrections; scorer v2; measured on SDK 2.0.0

- Rebased onto `main` after #9; the SDK under test is now 2.0.0 (was 1.5.0 on the review branch).
- Label corrections from an independent decoding of all 43 cases (each listed in the case's
  `expected.json` `revisions`):
  - `liquidity-add-damm-v2-by-keeper`: the owner no longer forbids `transfer` (its own reimbursement of the
    keeper is a transfer). The keeper's primary is now the incoming 19,442-lamport reimbursement transfer
    (#2.12/#2.13), not `fee_only`: receiving lamports and paying `meta.fee` do not cancel.
  - `lifecycle-pump-create-mint-and-first-buy`: no `token_mint` alternative on the creator's swap, `#2.9`
    added to the account-creation refs; no longer disputed.
  - `swap-stable-usdc-to-usdt-two-hop-dlmm`: one three-asset action split into the two top-level swaps.
  - `nft-transfer-sponsored-programmable`, `nft-sale-buyback-for-usdc`: sponsor-side token-record
    `account_create` / `account_close` actions added.
  - `dca-fill-executed-by-keeper`: the mandatory expectation keeps only the verified JTO arrival; the
    JitoSOL outflow from the DCA escrow is a reported alternative.
  - Disputes policy applied: `execution-jito-tip-sweep-signer-pays-fee-only` and
    `execution-tip-only-transaction` resolved as `tip` (`reward` an accepted complete synonym for the
    collector); `nft-sale-buyback-for-usdc` and `transfer-spl-memo-creates-ata-airdrop-memo` keep their
    disputed readings (`nft_purchase`, `airdrop`) as reported alternatives only.
- Scorer v2: complete-action matching before primary/secondary, so an exact secondary action is a
  secondary hit; amount comparison includes decimals and direction where the classification exposes it;
  secondary recall reported; per-perspective outcomes, exactness and a content hash per case stored in
  the baseline; the gate now also fails on new wrong labels, lost exactness inside failing cases,
  raw-count ratio drops, n/a transitions and corpus changes.
