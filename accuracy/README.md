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
bun run accuracy               # validate cases, replay, score, print the report, run the regression gate
bun run accuracy:baseline      # accept the current scores: rewrites baseline.json and BASELINE.md
bun run accuracy:check-types   # tsc --noEmit on the scorer
```

The replay is fully offline and deterministic. The RPC transport answers only
`getTransaction` for the case's own signature with the recorded body. Any other
signature or method throws, `fetch` is stubbed to throw, and token and NFT enrichment
are off.

## Rules for changes

- **No merge that adds a false positive or lowers a score without a reviewed exception.**
  The gate (`bun run accuracy`) fails when, compared with `baseline.json`:
  - a case that passed now fails;
  - a forbidden-label violation appears that was not there before;
  - any per-kind precision or recall drops.
- Improvements are accepted by running `bun run accuracy:baseline` **in the same commit**
  as the change, so the diff of `BASELINE.md` shows what moved. Adding cases changes the
  baseline too; regenerate it in the same commit and say why in the PR.
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
  borrow), `acceptableKinds` (a second kind accepted for a disputed label) and `note`.

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
     relayer) is `fee_only`.
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
6. **Fee.** Taken from `meta.fee`. It is never part of an action amount.
7. **Swap, lending, liquidity and stake participants.** `sender` and `receiver` are `null`
   (counterparty is a pool or program) unless a clear account exists, for example the
   new stake account.

## Scoring

The SDK returns one `classification` per transaction. The scorer maps it to one
predicted action:
- `kind` = `primaryType`;
- amounts = `primaryAmount` and `secondaryAmount`, compared as a set of (mint, raw) pairs,
  ignoring direction;
- participants = `sender` and `receiver`.

For each perspective:
- Per kind, computed on the primary action:
  - **TP** when the predicted kind is the expected primary kind or one of its
    `acceptableKinds`.
  - Otherwise **FN** for the expected kind, and the prediction is one of:
    - an **abstention** (`other`; or `fee_only` where a real action was expected);
    - a **secondary hit** (it matches a non-primary expected action);
    - a **false positive** for the predicted kind.
- **Forbidden violation**: the predicted kind is in any `forbidden` list of that perspective.
- **Amounts** and **participants** are checked only when the kind is right, and only
  where the expected value is non-null.
- **Fee**: the `fee` leg compared with `meta.fee`. **Execution**: from `tx.err`.
- **Reconciliation**: the distribution of `tx.reconciliation.status` is reported, not scored.

A perspective passes when the kind is right, there is no forbidden violation, and the
amounts and participants are exact. A case passes when every perspective passes and the
fee and execution agree. `[d]` in the report marks disputed labels.

SDK console output during replay (for example memo decoding errors) is captured and listed
in the report; it is not scored.

## Adding a case

1. Fetch the transaction with `getTransaction` and the exact params above. Store the
   response body byte for byte as `rpc.json`.
2. Read the instructions, inner instructions and balances, and write the `rationale`.
3. Write `expected.json` **before** running the scorer, and set `labelledBeforeScoring: true`.
   If a label is ever changed after seeing the SDK's output, say so in the PR with the reason.
4. Run `bun run accuracy`. Schema errors list every problem. Then run
   `bun run accuracy:baseline` and commit the case together with the new baseline.

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
