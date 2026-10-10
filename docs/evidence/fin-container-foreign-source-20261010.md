# Native Fin foreign-carrier acceptance gate

The new gate calls each installed package's receipt-verified foreign ABI with malformed inputs. It supplements the existing public-language consumer and direct Lean-adapter measurements. Each report identifies the caller as a separate C probe; it does not count these calls as Python, Rust, Java or another host's public-language execution.

## Cases

The [independent C fixture](../../tests/fixtures/fin-container-foreign-carriers.c) uses declarations from the production C generator and receipt-pinned Binding IR. It never constructs Lean object layouts. The 77 cases include:

- Null argument and output pointers, null data with nonzero length, and oversized spans with valid backing pointers.
- Invalid option tags at outer and nested positions, missing Nat limbs at first, middle and last positions, and invalid nested rows and all nine row/column positions.
- Structurally valid values outside Fin bounds, distinguished from structural errors by their exact diagnostics.
- Empty zero-bound containers, absent options, valid nested values, and poisoned payloads that an empty or absent value must ignore.

Each of the six entrypoints also executes 1,000 invalid/valid recovery pairs. The probe checks 12,077 calls in total. Every rejection must leave the caller's input and output slot unchanged, preserve borrowed ownership, and avoid adapter/source dispatch. Positive controls verify returned values and dispose of owned output through the generated API.

The observer authenticates the original package receipt, model, installed files, native libraries and defining symbols before execution. It requires missing-instrumentation refusal and rechecks installed files afterward. All six selected adapters and the two non-inlined source functions are measured. Four inlined identity source functions remain explicitly unmeasured.

## Verification at this source milestone

The real compiled Lean probe passed four tests, including missing/incorrect instrumentation and defining-library controls. Its package receipt is a synthetic source-test fixture, not an installed release acceptance record. The report, CI and source-history regression passed 40 tests with no failures or skips, including 170 weakened foreign-carrier report cases.

Original local logs:

| Log | SHA-256 |
|---|---|
| `build/vo1454-foreign-compiled-r2.tap` | `c534f051c211634980e504be6b87174c7bc64f8bfe752c0dd8da1af34f9c0f2e` |
| `build/vo1454-foreign-integration-r1.tap` | `dabab5f9a88801038082a3df4a652ca2709a07897b6da2139d190139cd8f9b50` |

Run the source probe with the pinned Lean compiler available:

```sh
LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST=1 \
  node --test --test-concurrency=1 tests/fin-container-foreign-carriers.test.mjs
```

Run the report and source-history controls:

```sh
node --test --test-concurrency=1 tests/fin-container-foreign-report.test.mjs
```

## Installed acceptance and CI

The installed producer now adds `foreignCarriers` whenever dispatch measurement is enabled. All nine measured CI selections require the new checker, covering ten native profiles and both Python floors. The checker first enforces every existing raw-adapter and public-host requirement, then validates the foreign-carrier supplement:

```sh
node scripts/check-fin-container-foreign-report.mjs \
  c,cpp build/native-fin-container-edges/edges-c-cpp.json
```

For Python, pass the selected floor with `--python 3.11` or `--python 3.12`.

The [original measured matrix](fin-container-edges-measured-20261010/README.md) retains its original reports and checker. Those reports have no foreign-carrier supplement and correctly fail the new gate. The [source-history ledger](fin-container-foreign-source-history-20261010.json) records ten exact transitions and 186 current-source pin updates without changing support claims or older evidence.

Fresh canonical installed runs, their original evidence archive, hosted acceptance and the final original-scope audit remain required before closing #1454/#1427. This source milestone does not promote type-surface support cells.
