# Fresh-Lean record and variant omission controls

The compiled review gate in [native-fin-records.test.mjs](../../tests/native-fin-records.test.mjs) now includes two additional independently changed reviews: removing the nominal-refinement extension from `FinRecords.Tile` and from `FinRecords.Shape`.

Each case copies the original Lean fixture into a fresh author directory, writes the independently authored review with the selected omission, and invokes the canonical C build. Acceptance requires `reviewed-ir-source-mismatch` at the nominal definition's extensions and no output directory. The existing five tightened, loosened, moved-field and active-case checks remain.

The new [history record](fin-record-review-omission-source-history-20261010.json) preserves seven exact test-source transitions from `49795a9076d9c1e8233ab9c2b861a5ad403953dc`. No coverage observation, source pin, original report or earlier ledger changes.

## Source validation

The five-root contract regression passed 84 tests with zero failures and four explicit environment-gated skips. Log: `build/vo1442-record-omission-contracts-r1.tap`, SHA-256 `33362776f6937b9a804da66fb14124ea8118b6f60f8c852c384a23c4eb66c1fa`. Changed-file lint and repository checked-JavaScript typechecking pass.

This regression skips the fresh-Lean gate. A separate compiler-enabled run must pass all seven review mutations before these additions count as compiled acceptance. It waits for the active installed-container queue's build slot.

The existing hosted record reports remain valid for their original five-case suite. These two new cases do not add installed host observations, and #1442 still requires coverage and documentation reconciliation.
