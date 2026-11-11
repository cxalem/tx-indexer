# Accuracy baseline changes

Every regeneration of `baseline.json` / `BASELINE.md` adds one entry here, in the same commit:
date, what changed, why. `bun run accuracy` fails if `baseline.json` changed without this file.

## 2026-11-11: versioned leg inputs; every classifier reads the 3111fd7 legs (no classification change)

`baseline.json` equals 3111fd7's apart from the scorer-v4 fields (`schemaVersion` and the per-component
exactness records); `BASELINE.md` is byte-identical to 3111fd7's. Every one of the 72 perspectives has
the same prediction as 3111fd7 (kind, amounts, participants, selecting classifier); the oracle test
(`packages/sdk/src/legacy-input.test.ts`) checks this with no exception. No `case.json`, `rpc.json` or
`expected.json` changed.

What this slice ships: truthful public legs (token accounts closed in the transaction, with
`closedTokenAccount` provenance), and versioned classifier inputs. All eleven classifiers declare
`v1-main`, the legs as built at 3111fd7 (frozen mapper), and their source is byte-identical to 3111fd7
(git check plus committed sha256 digests). The SDK list spam filter also reads `v1-main` (rebuilt from `tx` for the queried wallet, enriched from its own
mints), so list decisions are unchanged too, including for cached and deserialised transactions.

What was built, measured and deliberately not shipped:
- `swap` on the truthful legs (branch `feat/swap-closed-accounts`). On this set it turned
  `swap-pump-amm-sell-all-and-close` @32ktkabA… from a forbidden `transfer` into `kind_only` `swap`; on the
  8,280-transaction traffic sample, 52 `transfer` → `swap` changes (47 of them Pump sell-and-close). Rejected
  because balances cannot tell a sale from a transfer-and-close or a burn plus an unrelated mint: review
  counterexamples produced a fictitious swap (burn 1,000 JUNK + mint 1,000 JUNK to Carol + receive 10 USDC),
  turned a correct airdrop into a swap, and changed correct swaps (a closed sibling sending 30 W to Carol,
  a sibling's authority change, burn/reinitialise/mint, a separate send from a closed account, a buy with
  no pre snapshot). Three of its six accepted changes were rent-only `close-sell` fixtures read as
  token → SOL swaps. Sell-and-close goes to an instruction-backed recognizer (PumpSwap / Pump.fun first).
- `transfer` restricted to the wallet's own pairs (branch `feat/transfer-perspective`): 934 changed
  predictions on the traffic sample, 494 list-filter decisions changed, and the keeper perspective
  `liquidity-add-damm-v2-by-keeper` @ATdpV5tR… lost its (coincidental) `transfer` kind.

Earlier versions of this entry (commits 51d0792 and 7b7a018 on this branch) recorded those migrations'
score changes; this version replaces them and all of those changes are reverted.

## 2026-11-11: SDK fix, token accounts closed in the transaction (no case or label change)

The SDK now builds token balance changes from the union of `preTokenBalances` and
`postTokenBalances`: a non-native token account closed in the transaction (pre entry only)
produces a debit of its full pre amount, attributed to its pre owner. Before, only post entries
were read and the closed account's token was lost. Native wSOL accounts and fees are unchanged.
No `case.json`, `rpc.json` or `expected.json` changed (case hashes identical).

Later commits on the same branch first applied a burn-and-close rule in several classifiers, then
versioned leg inputs; in the end every classifier reads the 3111fd7 legs (see the entry above), so all
score and prediction changes listed in this entry are reverted. The leg-level fix (the closed account's
debit in the returned legs) stays.

Score records that changed: 3 of 72. Predictions that changed: 4 of 72 (the fourth is a
`wrong_label` before and after, so no score moved). Every other perspective, outcome, component and
prediction is identical:
- `swap-pump-amm-sell-all-and-close` @32ktkabA…: `wrong_label` `transfer` (forbidden) → `kind_only`
  `swap`. The wallet sells all of 2uQw…pump and closes the account (index 7). The 365,053,940 token
  debit now exists, so the swap classifier pairs it with the SOL credit. Token-out leg exact; the SOL
  in is 9,746,453 versus the expected 8,247,613. The difference, 1,498,840, is the closed account's
  1,513,840-lamport rent refund minus the 15,000-lamport network fee, both still folded into the SOL
  side; rent and fee handling are out of scope for this change.
- `transfer-token2022-sponsored-fee-then-close` @35y6MEFo…: `kind_only` → `correct`. The sender's
  2b1k… account is emptied and closed; its 199,000,000 debit now exists, so the transfer pairs it with
  the receiver's credit (amount, sender and receiver exact) instead of the 1,600,200-lamport rent
  movement between the fee payer and the rent receiver.
- `transfer-token2022-sponsored-fee-then-close` @Hg9dpcEm…: `kind_only` → `correct`, same reason.
- `transfer-token2022-sponsored-fee-then-close` @EBBkGATp…: still `wrong_label` `transfer` (no score
  change; expected `account_close`), but the prediction got worse for this wallet. Before: `transfer`
  of 1,600,200 SOL lamports GCEX… → EBBk… (its own incoming rent). After: `transfer` of 199,000,000
  PYUSD 35y6… → Hg9d…, another wallet's transfer. Cause: transfer pairing picks the best pair over the
  whole transaction and ignores the requested perspective
  (`packages/classification/src/engine/transfer-pairing.ts`, `findBestExternalTransferPair`). Tracked
  for the next slice. The gate cannot see it, because no component is measured for `wrong_label`
  predictions (also tracked). The case still fails on this perspective.

Before → after: primary action correct 13 → 15 of 72; kind_only 29 → 28; wrong_label 24 → 23;
secondary_hit 2, abstained 4, disputed_alternative 0, error 0 unchanged; primary kind right 42 → 43;
forbidden-label violations 11 → 10; amounts exact 13/42 → 15/43; participants exact 24/31 → 26/31;
cases passed 6/43 unchanged; fee 43/43, execution 43/43, reconciliation balanced 43 unchanged;
per kind: `swap` TP 10 → 11, FN 4 → 3 (recall 71.4% → 78.6%), `transfer` FP 22 → 21 (precision
57.7% → 58.8%); per category unchanged.

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
