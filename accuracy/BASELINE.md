# Accuracy baseline

Generated file: do not edit by hand. It records what the SDK version named below gets right and wrong on
the hand-labelled cases in `accuracy/cases/`. See `accuracy/README.md` for the format and the rules, and
`accuracy/CHANGES.md` for why the baseline last changed.

Regenerate (from the repo root) after a reviewed change to the SDK or to the cases:

```sh
bun run accuracy:baseline   # rewrites accuracy/baseline.json and accuracy/BASELINE.md
bun run accuracy            # gate: fails on any regression versus baseline.json
```

Every regeneration needs a dated line in `accuracy/CHANGES.md` in the same commit.

```text
tx-indexer accuracy report (sdk 2.0.0; 43 cases, 72 perspectives)
* provisional: 7 of 72 perspectives come from disputed cases (their verified part is scored).

Overall
  cases where the primary action is correct for every selected perspective,
    and fee and execution status agree                          6/43 (14.0%) *
  perspectives with the primary action correct (kind, amounts
    and non-null participants all match): outcome correct       15/72 (20.8%) *
  perspectives with the primary kind right (correct + kind_only;
    = per-kind TP)                                              43/72 (59.7%) *
  Outcomes (one per perspective; they sum to 72)
    correct                                                     15
    kind_only (kind right, amounts or participants wrong)       28
    secondary_hit (a secondary action exactly, not the primary) 2
    disputed_alternative (a reported reading exactly; a miss)   0
    abstained (other, or fee_only where an action was expected) 4
    wrong_label (false positives)                               23
    error (replay errors)                                       0
  forbidden-label violations                                    10
  amounts exact, over perspectives with the kind right and the
    amounts known (mint, raw, decimals; direction where exposed) 15/43 (34.9%)
  participants exact, over perspectives with the kind right and
    a non-null expected sender or receiver                      26/31 (83.9%)
  fee agreement (fee leg = meta.fee), per case                  43/43 (100.0%)
  execution status agreement, per case                          43/43 (100.0%)
  secondary actions found (recall; the SDK reports one action)  2/93 (2.2%)
  reconciliation status: balanced 43

Not part of the case-pass rule today: secondary actions (reported above), `authority`,
the native-vs-wSOL flag, and direction where the classification does not expose it.

Per kind (primary action, one per perspective; TP = correct or kind_only, FN = any other
outcome, FP = wrong_label for the predicted kind)
  kind               TP  FP  FN  precision  recall
  account_close       0   0   2       n/a    0.0%
  account_create      0   0   3       n/a    0.0%
  airdrop             0   2   0       0.0%    n/a
  fee_only            0   0   5       n/a    0.0%
  lending_borrow      0   0   1       n/a    0.0%
  lending_withdraw    0   0   1       n/a    0.0%
  liquidity_add       0   0   1       n/a    0.0%
  nft_receive         0   0   2       n/a    0.0%
  nft_sale            0   0   1       n/a    0.0%
  nft_send            0   0   1       n/a    0.0%
  other               1   0   0     100.0%  100.0%
  stake_deposit       1   0   0     100.0%  100.0%
  stake_withdraw      0   0   1       n/a    0.0%
  swap               11   0   3     100.0%   78.6%
  tip                 0   0   3       n/a    0.0%
  token_burn          0   0   1       n/a    0.0%
  token_mint          0   0   1       n/a    0.0%
  transfer           30  21   3      58.8%   90.9%

Secondary actions per kind (found / expected)
  account_close     0/13
  account_create    0/29
  swap              0/3
  tip               0/3
  token_burn        0/3
  token_mint        0/1
  transfer          2/41

Per category (cases passed)
  adversarial  0/16 (0.0%)
  execution    0/4 (0.0%)
  lifecycle    1/6 (16.7%)
  special      0/4 (0.0%)
  swap         1/15 (6.7%)
  transfer     5/17 (29.4%)

Forbidden-label violations
  dca-fill-executed-by-keeper @5wQULuzRkYe4KAttSD1L1fuxavjepcMn1PycNMmPchna: airdrop
  execution-jito-tip-sweep-signer-pays-fee-only @EvnRmnMrd69kFdbLMxWkTn1icZ7DCceRhvmb2SJXqDo4: transfer
  keeper-bot-executes-sell-for-user @AgmLJBMDCqWynYnQiPCuj9ewsNNsBJXyzoUhD9LJzN51: transfer
  lending-kamino-borrow-usds @3x1RsTx3a7idphqBXvjL7YD2bm6shHUF6HMEhAYiKrNb: transfer
  lending-kamino-withdraw-usdc @E354kEZjES9BiLjKnb97NjSxVgLXrt7UDY23Fjvj86Gr: transfer
  lifecycle-burn-and-close-four-accounts-rent-to-sponsor @J2A8tQeQTouDpsjeiEx55FAc7VnoXkWBHCe9kGcx96aD: transfer
  lifecycle-create-ata-only-token2022 @3YyU2RKQSdns4qf21oTQnuLykbDG5xY8x8uAmAiCUg6a: transfer
  lifecycle-create-ata-only-token2022 @EBHdJGE7cn7UXhZFG94p8p3f9qDxZM9XQk2LLbUjZrXz: transfer
  lifecycle-pump-create-mint-and-first-buy @HwRJBApsauj7PqyW9wsaU94FkQbXdRV2vrhPV4Cto4iU: transfer
  nft-sale-buyback-for-usdc @BTq5uRfTEAjKTwKkqDzSAXLAUstMX3kT2v6SzGBZs1th: transfer

Disputed interpretations (reported only: not part of the mandatory score; matching one is a miss for the primary)
  dca-fill-executed-by-keeper @5wQULuzRkYe4KAttSD1L1fuxavjepcMn1PycNMmPchna: disputed reading swap; SDK says airdrop
  nft-sale-buyback-for-usdc @GachaNgyXTU3zFogQ8Z5jR2BLXs8215X2AtEH18VxJq3: disputed reading nft_purchase; SDK says transfer
  nft-sale-buyback-for-usdc @miDtj3vgdxVykHzRyFwyG8MXpvK8eQqamSLVdBr7WPt: disputed reading nft_purchase; SDK says transfer
  transfer-spl-memo-creates-ata-airdrop-memo @5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9: disputed reading airdrop; SDK says transfer

SDK console output during replay (not scored)
  transfer-sol-with-memo-v1-program: Failed to decode memo: InvalidCharacterError: The string contains invalid characters.

Failing cases (37); [d] = disputed case
  [d] dca-fill-executed-by-keeper :: JD38..624k: predicted other, expected fee_only | 5wQU..chna: FORBIDDEN airdrop; predicted airdrop, expected swap
  execution-failed-jupiter-swap :: 7nwP..cvMf: predicted other, expected fee_only
  execution-failed-sol-transfer :: 36WA..8DyC: predicted other, expected fee_only
  execution-jito-tip-sweep-signer-pays-fee-only :: EvnR..qDo4: FORBIDDEN transfer; predicted transfer, expected fee_only | DjyD..9K8e: predicted transfer, expected tip|reward
  execution-tip-only-transaction :: CrRj..NG1G: predicted transfer, expected tip
  keeper-bot-executes-sell-for-user :: H9Ef..gHX1: kind only (swap); amounts got [out 198452020869 9VZe, in 76936031 EPjF] want [out 198452020869 9VZe, in 77886031 EPjF] | AgmL..zN51: FORBIDDEN transfer; predicted transfer, expected fee_only
  lending-kamino-borrow-usds :: 3x1R..KrNb: FORBIDDEN transfer; predicted transfer, expected lending_borrow
  lending-kamino-withdraw-usdc :: E354..86Gr: FORBIDDEN transfer; predicted transfer, expected lending_withdraw
  lifecycle-burn-and-close-four-accounts-rent-to-sponsor :: J2A8..96aD: FORBIDDEN transfer; predicted transfer, expected token_burn | 8dBo..SMfG: predicted transfer, expected account_close
  lifecycle-create-ata-only-token2022 :: 3YyU..Ug6a: FORBIDDEN transfer; predicted transfer, expected account_create | EBHd..ZrXz: FORBIDDEN transfer; predicted transfer, expected account_create
  lifecycle-pump-create-mint-and-first-buy :: 4mZu..ojng: kind only (swap); amounts got [out 58029245 So11, in 1788384000000 BnyQ] want [out 50710956 So11, in 1788384000000 BnyQ] | HwRJ..o4iU: FORBIDDEN transfer; predicted transfer, expected token_mint
  liquidity-add-damm-v2-by-keeper :: 2r3X..9oZx: predicted transfer, expected liquidity_add | ATdp..fgzF: kind only (transfer); amounts got [1817570053 FT6b] want [in 19442 So11]; participants got 2r3X..9oZx->HLnp..TLcC want 2r3X..9oZx->ATdp..fgzF
  [d] nft-sale-buyback-for-usdc :: BTq5..s1th: FORBIDDEN transfer; predicted transfer, expected nft_sale | miDt..7WPt: predicted transfer, expected nft_receive
  nft-transfer-sponsored-programmable :: miDt..7WPt: predicted transfer, expected nft_send | BTq5..s1th: predicted transfer, expected nft_receive | Gach..xJq3: predicted transfer, expected account_create
  stake-create-and-delegate :: HuZa..1JDL: kind only (stake_deposit); amounts got [out 7427745701 So11] want [out 7427731966 So11]; participants got HuZa..1JDL->null want HuZa..1JDL->B9XM..H3rX
  stake-withdraw-from-three-accounts :: CuEW..gn9g: predicted other, expected stake_withdraw
  swap-pump-amm-sell-all-and-close :: 32kt..yCyt: kind only (swap); amounts got [out 365053940 2uQw, in 9746453 So11] want [out 365053940 2uQw, in 8247613 So11]
  swap-pump-amm-tiny-sol-buy :: FXBg..WxzS: kind only (swap); amounts got [out 198714 So11, in 102337683 wGoX] want [out 193714 So11, in 102337683 wGoX]
  swap-stable-usdc-to-usdt-two-hop-dlmm :: gain..1vbP: kind only (swap); amounts got [out 1106941 EPjF, in 1107247 Es9v] want [out 1106941 EPjF, in 1106950 gain]
  swap-v0-jupiter-sol-to-token :: EMgS..PaEb: kind only (swap); amounts got [out 4147883 So11, in 1994890919495 FUSE] want [out 4142844 So11, in 1994890919495 FUSE]
  swap-v0-jupiter-sol-to-token-with-platform-fee :: Hyot..Nkqg: kind only (swap); amounts got [out 182605000 So11, in 157291256833 9QT8] want [out 182400000 So11, in 157291256833 9QT8]
  swap-v0-jupiter-token-to-sol :: 6bAW..3Uuh: kind only (swap); amounts got [out 2231314298 EaxA, in 22237362 So11] want [out 2231314298 EaxA, in 22242362 So11]
  swap-v1-jupiter-circular-route-usdc-gain :: CGgM..EpFz: kind only (swap); amounts got [out 7559 So11, in 1857 EPjF] want [in 1857 EPjF]
  swap-v1-jupiter-circular-route-with-jito-tip :: FUBV..SLRG: kind only (swap); amounts got [out 7029 So11, in 723 EPjF] want [in 723 EPjF]
  swap-v1-jupiter-then-send-output :: H4ar..XZDb: predicted transfer, expected swap | BNnN..9jGq: predicted airdrop, expected transfer
  swap-v1-router-sol-to-token-with-memo :: Dha7..miye: predicted transfer, expected swap
  transfer-four-tokens-one-recipient-sweep :: 5Z1Z..YMcA: predicted a secondary action (transfer #7), expected primary transfer | AEp8..ssFL: predicted a secondary action (transfer #7), expected primary transfer
  transfer-sol-durable-nonce-two-signers :: 95ip..nDW5: kind only (transfer); amounts got [out 56524094 So11] want [out 56483000 So11] | 5tzF..uAi9: kind only (transfer); amounts got [in 56524094 So11] want [in 56483000 So11]
  transfer-sol-dust-twenty-one-recipients :: 54SR..bunW: kind only (transfer); amounts got [out 5021 So11] want [out 1 So11] | 5VCw..NmcD: kind only (transfer); amounts got [5021 So11] want [in 1 So11]; participants got 54SR..bunW->AAAh..RBwb want 54SR..bunW->5VCw..NmcD
  transfer-sol-fee-paid-by-receiver-with-tip :: HLDi..6DWh: kind only (transfer); amounts got [out 50061798 So11] want [out 50000000 So11] | G5GF..Gyph: kind only (transfer); amounts got [in 50061798 So11] want [in 50000000 So11]
  transfer-sol-legacy-exchange-withdrawal :: H8sM..3WjS: kind only (transfer); amounts got [out 83921000 So11] want [out 83913000 So11] | 7jAD..8XMd: kind only (transfer); amounts got [in 83921000 So11] want [in 83913000 So11]
  transfer-sol-to-self-plus-jito-tip :: 2dbo..C2MW: predicted transfer, expected tip
  transfer-sol-v0-small :: mveQ..Qg1u: kind only (transfer); amounts got [out 113656 So11] want [out 108600 So11] | 5tzF..uAi9: kind only (transfer); amounts got [in 113656 So11] want [in 108600 So11]
  transfer-sol-with-jito-tip :: 5tK7..Uoi9: kind only (transfer); amounts got [out 1610400 So11] want [out 1400000 So11] | 5tzF..uAi9: kind only (transfer); amounts got [in 1610400 So11] want [in 1400000 So11]
  transfer-sol-with-memo-v1-program :: 2UPz..Mt4s: kind only (transfer); amounts got [out 1470049163 So11] want [out 1470041000 So11] | GgLn..S9Nq: kind only (transfer); amounts got [in 1470049163 So11] want [in 1470041000 So11]
  transfer-token2022-multi-recipient-distribution :: 5UdR..2Gqn: kind only (transfer); amounts got [out 867299215780000 7q5E] want [out 163580645280000 7q5E]; participants got 5UdR..2Gqn->Ekey..MuXd want 5UdR..2Gqn->53un..GLyr | 5VCw..NmcD: kind only (transfer); amounts got [867299215780000 7q5E] want [in 130576608620000 7q5E]; participants got 5UdR..2Gqn->Ekey..MuXd want 5UdR..2Gqn->5VCw..NmcD
  transfer-token2022-sponsored-fee-then-close :: EBBk..YhVz: predicted transfer, expected account_close
```
