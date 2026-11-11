# Accuracy baseline changes

Every regeneration of `baseline.json` / `BASELINE.md` adds one entry here, in the same commit:
date, what changed, why. `bun run accuracy` fails if `baseline.json` changed without this file.

## 2026-11-11: versioned leg inputs; transfer only pairs the wallet's own transfers (no case or label change)

Classifiers now read a declared leg input. `swap` and `transfer` are migrated to the truthful legs
(`v2-closed-token-accounts`); the nine others read the legs as built at 3111fd7 (`v1-main`) and return
exactly what 3111fd7 returns (proven per classifier, see `packages/sdk/src/legacy-input.test.ts`).
`transfer`, given a wallet, only considers pairs in which that wallet is the sender or the receiver, and
returns nothing when there is none. No `case.json`, `rpc.json` or `expected.json` changed.

Versus the previous baseline (4acdb61), 5 perspectives changed; every other outcome, component and
predicted kind is identical. All 5 come from the transfer perspective constraint:
- `liquidity-add-damm-v2-by-keeper` @ATdpV5tR…: `kind_only` `transfer` → `abstained` (`other`). **A
  regression of the primary-kind count.** The keeper's expected action is the 19,442-lamport fee
  reimbursement; its net lamport change is 0 (reimbursement minus `meta.fee`), so it has no leg of its
  own. The `transfer` before was another wallet's 1,817,570,053 FT6b… movement 2r3X… → HLnp…: right kind
  and sender only by coincidence (2r3X… is also the reimbursement payer), receiver wrong. With the
  constraint no pair involves the keeper. Seeing the reimbursement needs fee-separated legs (a future
  `v3-fee-separated` input).
- `lifecycle-burn-and-close-four-accounts-rent-to-sponsor` @J2A8tQeQ…: `wrong_label` (forbidden `transfer`
  of 1,513,840 lamports between two other accounts) → `abstained` (`other`). Expected `token_burn`.
- `lifecycle-create-ata-only-token2022` @EBHdJGE7…: `wrong_label` (forbidden `transfer` of 1,605,200
  lamports 3YyU… → 35ET…) → `abstained` (`other`). Expected `account_create`.
- `transfer-sol-dust-twenty-one-recipients` @5VCwKtCX…: still `kind_only`; the receiver is now the wallet
  itself instead of another recipient (participants exact false → true).
- `transfer-token2022-multi-recipient-distribution` @5VCwKtCX…: same, participants exact false → true.

Predictions that changed without an outcome change: `transfer-token2022-sponsored-fee-then-close`
@EBBkGATp… is `transfer` of its own incoming rent, 1,600,200 lamports GCEX… → EBBk… (as at 3111fd7;
still `wrong_label`, expected `account_close`), no longer another wallet's PYUSD transfer.
`keeper-bot-executes-sell-for-user` @AgmLJBMD… is `transfer` of 1,908,154 lamports AgmL… → AwtZ… (its
own SOL movement) instead of another wallet's 198,452,020,869 9VZe… transfer (still forbidden
`wrong_label`, expected `fee_only`).

Versus 3111fd7's baseline: the 5 changes above, plus the closed-account changes of the earlier entry
(`swap-pump-amm-sell-all-and-close` @32kt… `wrong_label` → `kind_only` swap; both perspectives of
`transfer-token2022-sponsored-fee-then-close` 35y6…/Hg9d… `kind_only` → `correct`). The only perspective
worse than at 3111fd7 is the keeper above.

Before → after (versus 4acdb61): primary action correct 15 → 15 of 72; kind_only 28 → 27; abstained
4 → 7; wrong_label 23 → 21; secondary_hit 2, disputed_alternative 0, error 0 unchanged; primary kind
right 43 → 42; forbidden-label violations 10 → 8; amounts exact 15/43 → 15/42; participants exact
26/31 → 28/30; cases passed 6/43 unchanged; `transfer` TP 30 → 29, FP 21 → 19, FN 3 → 4 (precision
58.8% → 60.4%, recall 90.9% → 87.9%).

## 2026-11-11: SDK fix, token accounts closed in the transaction (no case or label change)

The SDK now builds token balance changes from the union of `preTokenBalances` and
`postTokenBalances`: a non-native token account closed in the transaction (pre entry only)
produces a debit of its full pre amount, attributed to its pre owner. Before, only post entries
were read and the closed account's token was lost. Native wSOL accounts and fees are unchanged.
No `case.json`, `rpc.json` or `expected.json` changed (case hashes identical).

Later commits on the same branch first applied a burn-and-close rule in several classifiers; that was
replaced by versioned leg inputs (see the entry above): only `swap` and `transfer` read the legs with
closed-account debits, `swap` ignores closed-account debits of a mint that is not conserved in the legs,
and every other classifier reads the 3111fd7 legs. The scores in this entry are unaffected.

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
