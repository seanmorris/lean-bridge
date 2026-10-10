# Native nominal refusal diagnostics

The final #1442 audit found that a recursive variant containing `Fin 5`
failed metadata validation before the build could report its unsupported
boundary. Commit `4d65922df96dd297c36f9c369651d5a2ec05e330` makes the Lean
extractor reject that native signature before emitting supported metadata.
The error retains the selected declaration and Lean's source file, line
and column. It does not admit recursive refinements or erase their bounds.

## Original and corrected runs

| Producer | Result | Evidence |
| --- | --- | --- |
| `1840da12d270045b1340b16e98a2a8085f002337` | Generic and callback-bearing records rejected correctly. The recursive case returned an internal graph error with no declaration details. TAP: two passes, two failures including the parent. | [Original audit](fin-nominal-refusals-20261010/1840da1/index.json) |
| `4d65922df96dd297c36f9c369651d5a2ec05e330` | All three cases returned `native-elaboration-unsupported`, the selected declaration, the unsupported shape and its source position. TAP: four passes, no failures or skips. | [Corrected audit](fin-nominal-refusals-20261010/4d65922/index.json) |

Neither run produced an output directory. Each archive preserves its
original runner, TAP, source inputs, captured error envelopes and start
record. The corrected run also records its clean ending revision and
Lean executable identity. Both include the extractor and native metadata
projection from their exact Git revisions. These selected snapshots are
not a full build dependency closure.

Index SHA-256 values:

- Original: `09e944dac340d1508fc2c48b9a3a7ccf9397ad3c92ab68e347d8e0f1ee14c7b4`.
- Corrected: `092c365b9ac3a660fb29f5edec736a361e049094d14c4416eac1dd31008165fd`.

The registered regression also checks recursive results and an optional
array of an aliased recursive type. The existing fresh-Lean recursive
graph test checks that unrefined mutual recursion, aliases, generated
carriers and reviewed contracts still work.

The [source history](fin-nominal-refusal-source-history-20261010.json)
preserves eight exact predecessors and refreshes 186 current-source pins.
It changes no support observations or older receipt bytes.

## Installed supplements

The [Fin 0 installed matrix](fin-record-zero-native-20261010.md) has passed
all fifteen runtime selections on both routes. A separate installed test
checks aliases of the refined record and variant through the same
public C/C++ callers, independent reviewed aliases, two-root archive
reproduction and source-free installation. Both routes passed; the
[alias archive](fin-record-alias-native-20261010.md) preserves their originals.
The refusal audits above are compiler diagnostics, not installed acceptance.
