# Accuracy baseline changes

Every regeneration of `baseline.json` / `BASELINE.md` adds one entry here, in the same commit:
date, what changed, why. `bun run accuracy` fails if `baseline.json` changed without this file.

## 2026-11-11: scorer v4, exactness per component; secondary synonym bucket; baseline schema 4 (no SDK or label change)

No case file and no SDK code changed. Every headline number, per-kind count, per-category count and
per-perspective outcome is identical to the previous baseline (13 correct, 29 kind_only, 2 secondary_hit,
0 disputed_alternative, 4 abstained, 24 wrong_label, 0 error of 72; cases passed 6/43); `BASELINE.md`
is byte-identical. Only the shape of `baseline.json` changed.

- Exactness per component. Each perspective record now also stores `components`: one boolean per
  expected amount leg (`actions[i] amount <direction> <mint>`) and per non-null participant field
  (`actions[i] sender` / `receiver`), measured against the expectation the prediction was scored on
  (`actions[i]` or `actions[i].alternatives[j]`) for `correct`, `kind_only` and `secondary_hit`. The
  gate now fails when a component that was exact is wrong or no longer measured, unless the perspective
  became `correct`. Before, exactness was one boolean per perspective, so inside a perspective that was
  already inexact a previously exact leg could go wrong without failing the gate (example, now a test:
  in `swap-v0-jupiter-sol-to-token` the SOL leg is wrong and the FUSE leg exact; FUSE 1994890919495 →
  1994890919496 passed the gate, now it fails). The per-perspective `amountsExact` / `participantsExact`
  stay and still drive the headline.
- Secondary synonym bucket. A secondary hit on an accepted synonym of a secondary action is now counted
  in the expected action's kind (`secondaryPerKind`), not the synonym's; the matched kind stays in
  `secondaryHit.kind` for display. No secondary hit in the set matched a synonym, so no count moved;
  a synthetic test covers it.

## 2026-11-11: scorer v3, stricter outcome classes; baseline schema 3 (no SDK or label change)

No case file and no SDK code changed; every delta below comes from the scoring rules.

- Matching order is now: (1) complete mandatory match (primary, accepted alternatives, then
  secondary actions); (2) complete match of a `reported` alternative → `disputed_alternative`;
  (3) kind-only fallback against the primary. Before, the kind-only fallback ran before the
  reported check (a prediction exactly equal to the DCA two-leg reported swap scored as a
  mandatory `correct` swap), and a reported KIND alone was enough for `disputed_alternative`
  (an `nft_purchase` with no amounts and no participants escaped as disputed). Now a reported
  kind that does not equal the reported expectation completely is scored like any other
  prediction.
- New outcome `kind_only`: the primary kind is right but amounts or participants contradict the
  expectation where it is non-null. It was `correct` before. `correct` now means the primary
  action matches completely. Per-kind TP still counts `correct` + `kind_only` (kind agreement),
  so per-kind precision and recall are unchanged.
- Baseline records the matched action (`actions[<index>] <kind> <refs>`) and its exactness for
  every secondary hit. The gate now also fails when a secondary hit becomes anything but
  `correct` or the same secondary hit with the same exactness, when `correct` becomes
  `kind_only`, and when `kind_only` loses the primary kind.
- CHANGES.md co-change check: git failures fail the test; a shallow clone, a parentless commit or
  no git shows the check as skipped with `UNAVAILABLE: <reason>`, never as passed.

Before → after (43 cases, 72 perspectives):
- cases passed: 6/43 → 6/43 (unchanged: the pass rule already required exact amounts and participants);
- primary action correct (outcome `correct`): 42/72 → 13/72. The 42 was "primary kind right";
  under the stricter definition 29 of those perspectives are `kind_only`:
  - 14 SOL transfer perspectives in 7 cases with the amount off (fee, tip or rent folded in):
    `transfer-sol-durable-nonce-two-signers` (2), `transfer-sol-dust-twenty-one-recipients` (2;
    the receiver's participants are also wrong), `transfer-sol-fee-paid-by-receiver-with-tip` (2),
    `transfer-sol-legacy-exchange-withdrawal` (2), `transfer-sol-v0-small` (2),
    `transfer-sol-with-jito-tip` (2), `transfer-sol-with-memo-v1-program` (2);
  - 1 stake deposit with amount and stake account wrong: `stake-create-and-delegate`;
  - 4 token transfers with wrong amount and participants: `transfer-token2022-multi-recipient-distribution` (2),
    `transfer-token2022-sponsored-fee-then-close` (2);
  - 1 keeper reimbursement with wrong amount and participants: `liquidity-add-damm-v2-by-keeper` (ATdp…);
  - 9 swaps with an amount off: `keeper-bot-executes-sell-for-user`, `lifecycle-pump-create-mint-and-first-buy`,
    `swap-pump-amm-tiny-sol-buy`, `swap-stable-usdc-to-usdt-two-hop-dlmm`, `swap-v0-jupiter-sol-to-token`,
    `swap-v0-jupiter-sol-to-token-with-platform-fee`, `swap-v0-jupiter-token-to-sol`,
    `swap-v1-jupiter-circular-route-usdc-gain`, `swap-v1-jupiter-circular-route-with-jito-tip`;
- primary kind right (`correct` + `kind_only`): 42/72 → 42/72; per-kind TP/FP/FN: unchanged;
- wrong labels 24, abstentions 4, secondary hits 2 of 93, disputed alternatives 0, errors 0,
  forbidden violations 11, amounts exact 13/42, participants exact 24/31, fee 43/43, execution
  43/43: all unchanged. Outcome totals: 13 correct + 29 kind_only + 2 secondary_hit + 0
  disputed_alternative + 4 abstained + 24 wrong_label + 0 error = 72.

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
