# Accuracy baseline

Generated file: do not edit by hand. It records what today's SDK gets right and wrong on the
hand-labelled cases in `accuracy/cases/`. See `accuracy/README.md` for the format and the rules.

Regenerate (from the repo root) after a reviewed change to the SDK or to the cases:

```sh
bun run accuracy:baseline   # rewrites accuracy/baseline.json and accuracy/BASELINE.md
bun run accuracy            # gate: fails on any regression versus baseline.json
```

```text
tx-indexer accuracy report (sdk 1.5.0; 43 cases, 72 perspectives)

Overall
  cases passed (every perspective right, fee + execution right) 6/43 (14.0%)
  primary kind agreement                                        43/72 (59.7%)
  wrong labels (false positives)                                25
  abstentions (other/fee_only where an action was expected)     4
  predicted a secondary action instead of the primary           0
  forbidden-label violations                                    12
  replay errors                                                 0
  amounts exact (when kind right and amounts known)             13/43 (30.2%)
  participants exact (when kind right and expected non-null)    26/32 (81.3%)
  fee agreement (fee leg = meta.fee)                            43/43 (100.0%)
  execution status agreement                                    43/43 (100.0%)
  secondary actions expected / reported by the SDK              89 / 0
  reconciliation status: balanced 43

Per kind (primary action, one per perspective)
  kind               TP  FP  FN  precision  recall
  account_close       0   0   2       n/a    0.0%
  account_create      0   0   3       n/a    0.0%
  airdrop             0   2   0       0.0%    n/a
  fee_only            0   0   6       n/a    0.0%
  lending_borrow      0   0   1       n/a    0.0%
  lending_withdraw    0   0   1       n/a    0.0%
  liquidity_add       0   0   1       n/a    0.0%
  nft_receive         0   0   2       n/a    0.0%
  nft_sale            0   0   1       n/a    0.0%
  nft_send            0   0   1       n/a    0.0%
  other               1   0   0     100.0%  100.0%
  stake_deposit       1   0   0     100.0%  100.0%
  stake_withdraw      0   0   1       n/a    0.0%
  swap               10   0   4     100.0%   71.4%
  tip                 0   0   3       n/a    0.0%
  token_burn          0   0   1       n/a    0.0%
  token_mint          0   0   1       n/a    0.0%
  transfer           31  23   1      57.4%   96.9%

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
  liquidity-add-damm-v2-by-keeper @2r3XPyQZyrtpeHi3fK3ZYrNfB2f1sfAh1dfgxbzj9oZx: transfer
  nft-sale-buyback-for-usdc @BTq5uRfTEAjKTwKkqDzSAXLAUstMX3kT2v6SzGBZs1th: transfer
  swap-pump-amm-sell-all-and-close @32ktkabAVmaoKDRuo7rgQsP38zBB4p8SFyCyogn1yCyt: transfer

SDK console output during replay (not scored)
  transfer-sol-with-memo-v1-program: Failed to decode memo: InvalidCharacterError: The string contains invalid characters.

Failing cases (37); [d] = disputed label
  [d] dca-fill-executed-by-keeper :: JD38..624k: predicted other, expected fee_only | 5wQU..chna: FORBIDDEN airdrop; predicted airdrop, expected swap
  execution-failed-jupiter-swap :: 7nwP..cvMf: predicted other, expected fee_only
  execution-failed-sol-transfer :: 36WA..8DyC: predicted other, expected fee_only
  [d] execution-jito-tip-sweep-signer-pays-fee-only :: EvnR..qDo4: FORBIDDEN transfer; predicted transfer, expected fee_only | DjyD..9K8e: predicted transfer, expected tip|reward
  [d] execution-tip-only-transaction :: CrRj..NG1G: predicted transfer, expected tip
  keeper-bot-executes-sell-for-user :: H9Ef..gHX1: amounts got [198452020869 9VZe, 76936031 EPjF] want [198452020869 9VZe, 77886031 EPjF] | AgmL..zN51: FORBIDDEN transfer; predicted transfer, expected fee_only
  lending-kamino-borrow-usds :: 3x1R..KrNb: FORBIDDEN transfer; predicted transfer, expected lending_borrow
  lending-kamino-withdraw-usdc :: E354..86Gr: FORBIDDEN transfer; predicted transfer, expected lending_withdraw
  lifecycle-burn-and-close-four-accounts-rent-to-sponsor :: J2A8..96aD: FORBIDDEN transfer; predicted transfer, expected token_burn | 8dBo..SMfG: predicted transfer, expected account_close
  lifecycle-create-ata-only-token2022 :: 3YyU..Ug6a: FORBIDDEN transfer; predicted transfer, expected account_create | EBHd..ZrXz: FORBIDDEN transfer; predicted transfer, expected account_create
  [d] lifecycle-pump-create-mint-and-first-buy :: 4mZu..ojng: amounts got [1788384000000 BnyQ, 58029245 So11] want [1788384000000 BnyQ, 50710956 So11] | HwRJ..o4iU: FORBIDDEN transfer; predicted transfer, expected token_mint
  liquidity-add-damm-v2-by-keeper :: 2r3X..9oZx: FORBIDDEN transfer; predicted transfer, expected liquidity_add | ATdp..fgzF: predicted transfer, expected fee_only
  [d] nft-sale-buyback-for-usdc :: BTq5..s1th: FORBIDDEN transfer; predicted transfer, expected nft_sale | miDt..7WPt: predicted transfer, expected nft_receive|nft_purchase
  nft-transfer-sponsored-programmable :: miDt..7WPt: predicted transfer, expected nft_send | BTq5..s1th: predicted transfer, expected nft_receive | Gach..xJq3: predicted transfer, expected account_create
  stake-create-and-delegate :: HuZa..1JDL: amounts got [7427745701 So11] want [7427731966 So11]; participants got HuZa..1JDL->null want HuZa..1JDL->B9XM..H3rX
  stake-withdraw-from-three-accounts :: CuEW..gn9g: predicted other, expected stake_withdraw
  swap-pump-amm-sell-all-and-close :: 32kt..yCyt: FORBIDDEN transfer; predicted transfer, expected swap
  swap-pump-amm-tiny-sol-buy :: FXBg..WxzS: amounts got [198714 So11, 102337683 wGoX] want [193714 So11, 102337683 wGoX]
  swap-stable-usdc-to-usdt-two-hop-dlmm :: gain..1vbP: amounts got [1106941 EPjF, 1107247 Es9v] want [1106941 EPjF, 1107247 Es9v, 280 gain]
  swap-v0-jupiter-sol-to-token :: EMgS..PaEb: amounts got [1994890919495 FUSE, 4147883 So11] want [1994890919495 FUSE, 4142844 So11]
  swap-v0-jupiter-sol-to-token-with-platform-fee :: Hyot..Nkqg: amounts got [157291256833 9QT8, 182605000 So11] want [157291256833 9QT8, 182400000 So11]
  swap-v0-jupiter-token-to-sol :: 6bAW..3Uuh: amounts got [2231314298 EaxA, 22237362 So11] want [2231314298 EaxA, 22242362 So11]
  swap-v1-jupiter-circular-route-usdc-gain :: CGgM..EpFz: amounts got [1857 EPjF, 7559 So11] want [1857 EPjF]
  swap-v1-jupiter-circular-route-with-jito-tip :: FUBV..SLRG: amounts got [723 EPjF, 7029 So11] want [723 EPjF]
  swap-v1-jupiter-then-send-output :: H4ar..XZDb: predicted transfer, expected swap | BNnN..9jGq: predicted airdrop, expected transfer
  swap-v1-router-sol-to-token-with-memo :: Dha7..miye: predicted transfer, expected swap
  transfer-four-tokens-one-recipient-sweep :: 5Z1Z..YMcA: amounts got [792000000 5oSo] want [440203531 DpLa] | AEp8..ssFL: amounts got [792000000 5oSo] want [440203531 DpLa]
  transfer-sol-durable-nonce-two-signers :: 95ip..nDW5: amounts got [56524094 So11] want [56483000 So11] | 5tzF..uAi9: amounts got [56524094 So11] want [56483000 So11]
  transfer-sol-dust-twenty-one-recipients :: 54SR..bunW: amounts got [5021 So11] want [1 So11] | 5VCw..NmcD: amounts got [5021 So11] want [1 So11]; participants got 54SR..bunW->AAAh..RBwb want 54SR..bunW->5VCw..NmcD
  transfer-sol-fee-paid-by-receiver-with-tip :: HLDi..6DWh: amounts got [50061798 So11] want [50000000 So11] | G5GF..Gyph: amounts got [50061798 So11] want [50000000 So11]
  transfer-sol-legacy-exchange-withdrawal :: H8sM..3WjS: amounts got [83921000 So11] want [83913000 So11] | 7jAD..8XMd: amounts got [83921000 So11] want [83913000 So11]
  transfer-sol-to-self-plus-jito-tip :: 2dbo..C2MW: predicted transfer, expected tip
  transfer-sol-v0-small :: mveQ..Qg1u: amounts got [113656 So11] want [108600 So11] | 5tzF..uAi9: amounts got [113656 So11] want [108600 So11]
  transfer-sol-with-jito-tip :: 5tK7..Uoi9: amounts got [1610400 So11] want [1400000 So11] | 5tzF..uAi9: amounts got [1610400 So11] want [1400000 So11]
  transfer-sol-with-memo-v1-program :: 2UPz..Mt4s: amounts got [1470049163 So11] want [1470041000 So11] | GgLn..S9Nq: amounts got [1470049163 So11] want [1470041000 So11]
  transfer-token2022-multi-recipient-distribution :: 5UdR..2Gqn: amounts got [867299215780000 7q5E] want [163580645280000 7q5E]; participants got 5UdR..2Gqn->Ekey..MuXd want 5UdR..2Gqn->53un..GLyr | 5VCw..NmcD: amounts got [867299215780000 7q5E] want [130576608620000 7q5E]; participants got 5UdR..2Gqn->Ekey..MuXd want 5UdR..2Gqn->5VCw..NmcD
  transfer-token2022-sponsored-fee-then-close :: 35y6..CsJb: amounts got [1600200 So11] want [199000000 2b1k]; participants got GCEX..qEyF->EBBk..YhVz want 35y6..CsJb->Hg9d..o7Fa | Hg9d..o7Fa: amounts got [1600200 So11] want [199000000 2b1k]; participants got GCEX..qEyF->EBBk..YhVz want 35y6..CsJb->Hg9d..o7Fa | EBBk..YhVz: predicted transfer, expected account_close
```
