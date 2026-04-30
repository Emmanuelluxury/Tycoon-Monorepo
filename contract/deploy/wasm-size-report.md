## WASM size check (budget v3)

Regression threshold: **3%** over committed baseline (deployment cost / rent awareness).

| Contract | Baseline (B) | Current (C) | Δ (C−B) | Max allowed (⌊B×(100+3)/100⌋) | Status |
|----------|-------------:|------------:|--------:|----------------------------------------------:|:-------|
| `tycoon_boost_system.wasm` | 24960 | 24960 | 0 | 25708 | ✅ |
| `tycoon_token.wasm` | 20802 | 20802 | 0 | 21426 | ✅ |
| `tycoon_reward_system.wasm` | 21511 | 21503 | -8 | 22156 | ✅ |
| `tycoon_game.wasm` | 30798 | 30790 | -8 | 31721 | ✅ |
| `tycoon_collectibles.wasm` | 32796 | 32796 | 0 | 33779 | ✅ |

