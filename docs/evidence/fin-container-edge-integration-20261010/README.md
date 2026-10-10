# Native container-edge integration

This milestone integrates the ten native public-call observers from `8287f60cc78a55f6e201a364656d8dc556411add` with the indexed diagnostics at `e503ba7c40d2e32002028559b70f2dbcc94983fc`. The original consumer assertions remain intact. Errors identify the failing argument, optional value and nested element, including first, middle and last invalid positions.

## Compiled source checks

```sh
LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST=1 \
node --test --test-concurrency=1 \
  tests/fin-container-edges.test.mjs \
  tests/fin-container-edge-{closure,cpp,dispatch,dotnet-closure,dotnet,jvm-closure,jvm,php-closure,php,public,python-closure,python,ruby-closure,ruby,rust,wit}.test.mjs
```

The integrated run passed 93 tests, with zero failures and one canonical-installed-matrix skip, in 1,406.467 seconds. [The original TAP](source.tap) has SHA-256 `ed2f065d8feb914bd41dca1da29a53a6344a2acdafd0127b76535b59bd76b11a`. It exercises real compiled Lean through C, C++, Python, Rust, Ruby, C#, Java, Kotlin, native PHP and Wasmtime C. Source fixtures use synthetic receipts. Fresh compiler extraction, two-root package reproduction and source-free canonical installation remain separate acceptance gates.

The indexed-diagnostic integration changes neither expected call counts nor source-entry coverage. Each observer measures the six edge adapters and the two non-inlined `present` and `flatten` functions. Four inlined identity functions remain explicitly unmeasured.

## Installed-report gate

After producing a measured canonical report, check the exact selected hosts:

```sh
node scripts/check-fin-container-edge-report.mjs \
  c,cpp build/native-fin-container-edges/edges-c-cpp.json
```

Use `--python 3.11` or `--python 3.12` when the selection includes Python and requires that interpreter floor. Host selections must be sorted, unique and explicit. The checker requires both the separate raw-adapter measurements and the actual public-language observations, complete ordered transcripts, current probe identities, the original archive identities, relocation, repeated execution and unchanged installed files. Host-specific checks retain the package-manager, interpreter, debugger, dependency and loaded-definition identities recorded by the observers. A raw C caller cannot substitute for another language's public calls.

Checker unit fixtures are synthetic format controls, not installed execution evidence. The negative tests reject dropped measurements, changed call rows, stale probes, missing environment identities and partial package information. Python checks the whole virtual environment, including package-manager files, rather than requiring it to contain only the wheel payload.

The combined checker/history regression passed all 15 tests without skips. It rejected 230 cross-host mutations, 52 host-specific mutations and eight coordinated missing-environment claims. Original TAP: `build/vo1454-report-integration-r1.tap`, SHA-256 `c100408c46424131cdc4bdd007fd89daca155191c2cd24ee0bc10bc7aabe537e`. The repository test-profile checks passed all four tests, and checked JavaScript passed.

## Source history and remaining work

The new integration ledger records ten exact source transitions and refreshes 194 current source pins. It preserves every prior observation and support claim, all original evidence files and both preceding diagnostic ledgers. Unknown source edits remain unauthenticated. Binary evidence is hashed as bytes and is never passed through text normalization.

The complete canonical installed matrix, both Python floors, hosted CI acceptance, and the original #1427/#1454 coverage audit remain open. This integration does not close either task or promote type-surface support.
