# Accuracy set

A hand-labelled set of real mainnet transactions, used to measure how often the SDK
labels a transaction correctly. Each case is replayed offline through the SDK's public
`getTransaction` path and scored against labels a person wrote by reading the
transaction. The scores today are low on purpose: the set records today's truth,
failures included, so every later change to the classifier shows a number.

Nothing in this directory ships in the npm package (`packages/sdk` publishes only
`dist/` and its docs; check with `npm pack --dry-run` in `packages/sdk`).

## Commands (from the repository root)

```sh
bun run accuracy               # tsc on the scorer, then validate, replay, score, report, and run the regression gate
bun run accuracy:baseline      # accept the current scores: rewrites baseline.json and BASELINE.md
bun run accuracy:check-types   # tsc --noEmit on the scorer only
```

The replay is fully offline and deterministic. The RPC transport answers only
`getTransaction` for the case's own signature with the recorded body. Any other
signature or method throws, `fetch` is stubbed to throw, and token and NFT enrichment
are off.

## Rules for changes

- **No merge that adds a false positive or lowers a score without a reviewed exception.**
  `baseline.json` stores, per case, a content hash of `case.json` + `rpc.json` +
  `expected.json`, fee and execution agreement, and per perspective the outcome
  (`correct`, `secondary_hit`, `disputed_alternative`, `abstained`, `wrong_label`, `error`),
  the predicted kind, and whether amounts and participants were exact. The gate
  (`bun run accuracy`) fails when, compared with `baseline.json`:
  - a case that passed now fails;
  - a perspective that was `correct` is no longer correct;
  - a new `wrong_label` appears (including a wrong label that changed kind, and an
    abstention that became a wrong label);
  - amounts, participants, fee or execution that were exact become wrong, also inside cases
    that already fail;
  - a forbidden-label violation appears that was not there before;
  - a per-kind precision or recall drops, compared on raw counts, or moves between a
    number and n/a in a way that hides new false positives or lost true positives;
  - a case or perspective disappears or is added, or any case file changed, without the
    baseline being regenerated.
- Improvements and corpus changes are accepted by running `bun run accuracy:baseline` **in
  the same commit** as the change, together with a dated entry in `accuracy/CHANGES.md`
  saying what changed and why. The test fails if `baseline.json` has uncommitted changes
  without `CHANGES.md` also changing, and if the last commit that touched `baseline.json`
  did not touch `CHANGES.md`. Outside a git checkout this check is skipped.
- The vocabulary check (the literal kind list in `src/schema.ts` must equal `TxPrimaryType`)
  is a compile-time check. `bun run accuracy` runs `tsc` first, so it cannot drift silently.
- Known failures do not fail the gate: they are the baseline.
- `other` is better than a wrong label. An abstention (`other`, or `fee_only` where a real
  action was expected) counts as a miss. A wrong label counts as a false positive, which
  is worse, and it can also be a forbidden-label violation.

## Case format

One directory per case under `cases/<id>/`:

| File | Content |
| --- | --- |
| `rpc.json` | The **verbatim** `getTransaction` JSON-RPC response body (`encoding: "json"`, `maxSupportedTransactionVersion: 1`, `commitment: "finalized"`), stored as raw text so large integers survive. Never re-serialise it. |
| `case.json` | `id`, `signature`, `cluster`, `endpoint`, `slot`, `blockTime`, `transactionVersion`, `capturedAt`, `commitment`, `encoding`, `rpc` (method and params), `perspectives` (wallets to classify from, each with a `reason`), `categories`, `tags`, `rationale` (what the transaction did, citing instruction positions such as `#3` or `#2.5` = inner instruction 5 of top-level 2), optional `sources` (public docs used to read an instruction), and `recordedFrom` / `relatedFixture` when the body came from an existing fixture. |
| `expected.json` | `fee` (= `meta.fee`), `execution` (`succeeded`/`failed`), `disputed` + `openQuestions`, `notes`, and per perspective the expected **actions**. |

Each action has:

- `kind`: today's `TxPrimaryType` vocabulary where one fits, otherwise one of this fixed
  list and nothing else: `token_burn`, `account_close`, `account_create`, `wrap_sol`,
  `unwrap_sol`, `tip`, `liquidity_add`, `liquidity_remove`, `lending_deposit`,
  `lending_withdraw`, `lending_borrow`, `lending_repay`, `token_mint`, `unknown`.
- `primary`: exactly one `true` per perspective.
- `sender`, `receiver`: addresses, or `null` with a `participantsNote` giving the reason.
  `authority` is optional and not scored today.
- `amounts`: raw integer strings with `mint`, `decimals` and `direction` (relative to the
  perspective). SOL uses the native mint `So111…112`, with `native: true` for lamports and
  `native: false` for a wSOL token account. `[]` means no movement for this wallet; `null`
  means the movement cannot be established from the transaction (an `amountsNote` is required).
- `instructionRefs`: the instructions that justify the action.
- Optional `forbidden` (kinds that would be wrong here, for example `transfer` for a lending
  borrow) and `note`.
- Optional `alternatives`: each is a **complete** expectation (`kind`, `sender`, `receiver`,
  `amounts`, `note`) with `scoring`:
  - `accepted`: an explicit synonym that counts as correct in the mandatory score (for example
    `reward` for collected tips). It must not repeat the action's kind or be forbidden.
  - `reported`: a disputed interpretation. It is listed in its own report section and never
    counts towards the score or the gate. Only allowed in a `disputed` case.

`expected.json` may also carry `revisions`: label changes made after the first scoring run,
with the date, who asked for them and what changed.

`src/schema.ts` (zod) validates every file. Cross-file checks also run:
- signature, slot, version, fee and execution must match `rpc.json`;
- every address must appear in the transaction (account keys, lookup-table addresses or
  token-balance owners);
- every token mint must appear in the token balances;
- each perspective has exactly one primary action, and the primary kind is not forbidden.

## How labels are set

Labels come only from reading the transaction:
- program ids;
- instruction tags or discriminators where the layout is public: System, SPL Token and
  Token-2022, ATA, Stake, Memo, and Anchor `sha256("global:<name>")[0..8]`;
- the accounts, inner instructions and pre/post balances.

They never come from the SDK's output or an explorer's label, and they are written
before the scorer runs on the case. When a protocol instruction cannot be read with
confidence, the kind is `unknown`, the certain token movements are still listed, and the
case is marked `disputed` with the open question.

Conventions used throughout the set:

1. **Primary action.**
   - A failed transaction is `fee_only` for the fee payer.
   - A wallet that only signs and pays the fee for someone else's action (keeper, crank,
     relayer) is `fee_only`. If it also receives something (for example a fee
     reimbursement), that incoming action is primary: receiving lamports and paying
     `meta.fee` are separate facts even when the numbers are equal.
   - A nonzero action with an external party takes precedence over a self-transfer.
   - A wallet that is not involved at all is `other`.
   - Otherwise the protocol action is primary over incidental ones (tips, account
     creation, rent refunds).
   - Among actions of the same kind, the first in instruction order is primary.
2. **Aggregation.** Consecutive instructions of the same kind, mint and participants
   (for example three stake withdraws to the same wallet) are one action with the summed
   amount. Transfers to different receivers are separate actions.
3. **Swap amounts.**
   - Everything the wallet paid in, and received from, the swap instruction, protocol and
     platform fees included.
   - The network fee, tips and rent are excluded; when present they are separate actions.
   - A circular route (same mint out and back) records the net.
   - Fees paid after the swap by separate top-level transfers are separate `transfer` actions.
4. **Temporary accounts.** A token account created and closed within the transaction
   (for example a temporary wSOL account) belongs to the parent action and is not listed.
   Surviving accounts and rent paid to someone else are listed as `account_create` or
   `account_close`.
5. **Tips.** A transfer to one of the published Jito tip accounts is `tip`, not `transfer`.
   `tip` covers both paying tips and collecting them (the tip receiver sweeping the tip
   accounts); `reward` is accepted as a complete synonym for the collector.
6. **Fee.** Taken from `meta.fee`. It is never part of an action amount.
7. **Two top-level swaps are two actions** (different pools, different mint pairs), even when
   the second spends the first's output; the first is primary. A balance of the intermediate
   token consumed from the wallet's existing inventory is not a fee.
8. **Movements the transaction cannot attribute** (for example output of a DCA position
   whose owner is not visible) are not mandatory: only the verified movement is expected,
   and the attributed reading is a `reported` alternative with an open question.
9. **Swap, lending, liquidity and stake participants.** `sender` and `receiver` are `null`
   (counterparty is a pool or program) unless a clear account exists, for example the
   new stake account.

## Disputes policy

A case is `disputed` when its open questions cannot be settled from the transaction.
Scoring of a disputed case:
- The objectively verified part (the mandatory primary action, its amounts and participants)
  counts in the mandatory score like any other case.
- The disputed interpretation is a `reported` alternative. It is shown in the report's
  "Disputed interpretations" section, and it can never fail the gate. A prediction of a
  reported kind is recorded as `disputed_alternative`: a miss for the mandatory kind, but not
  a false positive. It still fails the gate if that perspective used to be correct.
- Headline numbers that include perspectives from disputed cases are marked provisional.

Settled so far:
- Jito tip sweep: the collector is `tip`, with `reward` an accepted complete synonym. Resolved.
- A transfer to a tip account on its own: `tip`. Resolved.
- Pump create plus first buy: the creator's primary is `swap`; the mint is its own action. Resolved.
- NFT buyback: seller `nft_sale`, payer `transfer`, NFT receiver `nft_receive`. Whether the payer
  and the NFT receiver are under common control stays disputed (`nft_purchase` is reported only).
- Transfer with an "airdrop" memo: `transfer` is the fact. The airdrop purpose stays a disputed
  reading, reported separately, never part of the mandatory score.
- DCA fill: the JTO arriving at the owner is the fact. Attributing the escrow's JitoSOL to the
  owner stays disputed (the escrow's owner in the token balances is the DCA account).

## Scoring

The SDK returns one `classification` per transaction. The scorer maps it to one
predicted action:
- `kind` = `primaryType`;
- amounts = `primaryAmount` and `secondaryAmount`, compared as a multiset of
  (mint, raw, decimals). Direction is compared where the classification exposes it: for
  `swap` the primary amount is what was sent and the secondary what was received; for a
  single amount it is `out` when the perspective is the sender and `in` when it is the
  receiver. Elsewhere direction is not compared. The SDK uses the SOL mint for native SOL and
  wSOL alike, so the `native` flag is not compared;
- participants = `sender` and `receiver`. `authority` is not compared.

For each perspective the prediction is matched in this order:
1. it equals the primary action (or an `accepted` alternative) completely: kind, amounts and
   non-null participants. Outcome **correct**, amounts and participants exact;
2. it equals a non-primary expected action completely. Outcome **secondary hit**: not the
   primary, and not a false positive;
3. its kind is the primary kind (or an accepted alternative's). Outcome **correct**, with
   amounts and participants checked and reported separately;
4. its kind is a `reported` alternative. Outcome **disputed alternative**;
5. `other`, or `fee_only` where a real action was expected. Outcome **abstention**, a miss;
6. anything else. Outcome **wrong label**, a false positive for the predicted kind.

Per kind, computed on the primary action: TP for outcome correct, FN otherwise, FP for a wrong
label. Secondary recall is reported per kind and overall: expected non-primary actions that
the prediction equals completely. The SDK reports one action per transaction, so it is close
to zero today.
- **Forbidden violation**: the predicted kind is in any `forbidden` list of that perspective.
- **Amounts** and **participants** are checked only when the kind is right, and only
  where the expected value is non-null.
- **Fee**: the `fee` leg compared with `meta.fee`. **Execution**: from `tx.err`.
- **Reconciliation**: the distribution of `tx.reconciliation.status` is reported, not scored.

A perspective passes when the outcome is correct, there is no forbidden violation, and the
amounts and participants are exact. A case passes ("primary action correct for every selected
perspective") when every perspective passes and the fee and execution agree. Secondary actions,
`authority`, the native-vs-wSOL flag, and direction where the classification does not expose
it are **not** part of the case-pass rule today. `[d]` in the report marks disputed cases.

SDK console output during replay (for example memo decoding errors) is captured and listed
in the report; it is not scored.

## Adding a case

1. Fetch the transaction with `getTransaction` and the exact params above. Store the
   response body byte for byte as `rpc.json`.
2. Read the instructions, inner instructions and balances, and write the `rationale`.
3. Write `expected.json` **before** running the scorer, and set `labelledBeforeScoring: true`.
   If a label is ever changed after seeing the SDK's output, add a `revisions` entry and say
   so in the PR with the reason.
4. Run `bun run accuracy`. Schema errors list every problem. Then run
   `bun run accuracy:baseline`, add an entry to `CHANGES.md`, and commit the case, the new
   baseline and the entry together.

Only public on-chain data and your own notes go in a case. Do not use third-party labelled
datasets or explorer labels as the source of truth.

## Coverage today

43 transactions, 72 perspectives, captured on 2026-11-10 from `https://api.mainnet-beta.solana.com`.
A case can have more than one category:
- transfer 17
- swap 15
- lifecycle 6
- execution 4
- special 4
- adversarial 16

Transaction versions: 19 legacy, 17 v0 (with lookup tables), 7 v1.

Not covered yet:
- liquidity remove;
- wrapping SOL and keeping the wSOL;
- a standalone unwrap;
- a memo-only transaction;
- a vote transaction;
- a zero-decimal fungible token;
- a lending deposit or repay;
- Marginfi (the sampled transactions were cranks and flash loans).

The two transactions behind the `test.failing` tests in `packages/sdk/src/alt-replay.test.ts`
are included as `swap-v1-router-sol-to-token-with-memo` and
`swap-v1-jupiter-circular-route-usdc-gain`.

Recorded findings outside the classifier, not fixed here:
- `packages/domain` has an import cycle (`tx/tx.types.ts` ↔ `actors/counterparty.types.ts`).
  A runtime import of `TxPrimaryTypeSchema` from source throws a ReferenceError, which is why
  `src/schema.ts` keeps a literal list checked by `tsc`.
- The memo parser logs `Failed to decode memo: InvalidCharacterError` on the Memo v1
  instruction in `transfer-sol-with-memo-v1-program`. It appears in the report and is not scored.
