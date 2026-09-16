# Real-Lean type corpus foundation, 2026-09-16

VO 1217. This milestone adds a shared input catalog, fresh Lean oracles, an installed Python adapter and a report that retains untested profiles and positions as gaps. It does not change generated APIs or promote entries in the type-support inventory.

## Executed libraries

[Shop.Pricing](../../tests/fixtures/type-corpus/Shop/Pricing.lean) and [Telemetry.Readings](../../tests/fixtures/type-corpus/Telemetry/Readings.lean) each expose 12 functions. Their names, calculations, record layouts and collection transformations differ. Shop reverses the outer array; Telemetry reverses each inner array. Dependency calls return different values, which the harness checks.

Each library has a local Lake dependency and a pinned Git dependency. The tests create the Git repositories in a private offline cache. These are dependency-resolution fixtures, not fetched third-party libraries. Their selected entry modules are nested Lean modules. Each contains three proved lemmas, checked during fresh compilation.

The [input catalog](../../tests/fixtures/type-corpus/cases.mjs) uses tagged JSON values, decimal strings for exact integers, and language-neutral rejection categories. Adapter metadata names Python's public functions and maps range/type rejections to `ValueError`/`TypeError`. The consumer calls those generated public functions and dataclasses, without raw ABI access.

## Differential and installation checks

For each library, the [harness](../../tests/helpers/type-corpus-python.mjs):

1. Compiles fresh Lean interfaces and runs a Lean oracle that evaluates the source functions. No mock supplies expected results.
2. Builds a wheel from each of two relocated workspaces. Archive records and binding IR identities must match. The original source workspace must remain unchanged.
3. Checks that compiler-produced module hashes match the source bytes used by the oracle, including both dependencies.
4. Compiles a separate pending module in Lean, then requires native source elaboration to reject its unsupported export. A compiler crash, missing tool or unrelated source error cannot pass this check. No release directory may remain.
5. Copies only the prepared archive and package-set receipt into a new consumer directory, then deletes the source workspaces, oracle build and unpacked releases.
6. Verifies the relocated handoff with the Node-only CLI. Python creates a fresh virtual environment, installs the exact wheel with pip offline and calls its public API with compiler and runtime override paths disabled.
7. Compares each positive result with the fresh Lean result. Invalid host inputs must raise the expected exception, followed by a successful recovery call. Copied records must remain frozen and unchanged after nested input lists are cleared.

Across both libraries, **48 installed cases pass**: 32 differential results and 16 host-input rejections. They exercise `Unit`, `Bool`, `UInt32`, `UInt64`, `Int64`, `Nat`, `Int`, `String`, `ByteArray`, nested arrays and records. Inputs include zero, 4,097-bit natural numbers, negative large integers, fixed-width wraparound, embedded NUL and Unicode strings, and empty collections.

`Shop.Pending.discount : Bool → Option Nat` and `Telemetry.Pending.checkedCount : Int → Except String Nat` compile in Lean but are rejected with `native-elaboration-unsupported` when selected for Python packaging. Their report entries remain unsupported source-elaboration observations, not installed type coverage.

## Artifact identities

The local run used x86-64 Debian 12, Node 22.23.2, Python 3.11.2 and Lean 4.32.2, compiler commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`. It set `LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36` for this host. The production floor and Ubuntu CI default remain 2.38.

| Local archive | SHA-256 |
| --- | --- |
| `shop_corpus-1.0.0-py3-none-manylinux_2_36_x86_64.whl` | `341fbfbfac1d8306aa44adf8c7c3ea80ffb19f45725be2a760f183cf81a116aa` |
| `telemetry_corpus-1.0.0-py3-none-manylinux_2_36_x86_64.whl` | `36711c04782c9bc6d3a66b079837e867bb607904769475a80aeeef16f5b4eae9` |

Both wheels bind runtime identity `e7d08d91baf7f70d791a79bd611779d311201ce6b6530f478be4f8ff1113be1f`. Each archive reproduced independently. Scratch directories and installed environments are removed after execution.

## Report and remaining work

`build/type-corpus/python.json` records the complete input catalog, source and harness hashes, compiler version/hash, dependency revisions, source/Lake snapshots, archive hashes, runtime and binding IR identities, receipt hash, Lean results and per-case installed observations. Corpus inputs must not change while the test runs. A failed run removes the previous report and writes no replacement.

All 6,562 profile/path/type/position cells appear. This first slice observes **27 Python ordinary-source cells** through the named cases and retains **6,535 gaps**. A scoped case is not completion of a cell's full semantic requirements. The existing support inventory remains unchanged at 656 installed-tested cells.

The other 16 profile adapters, reviewed-IR execution and remaining type families/positions are still work under VO 1217. Missing adapters are not treated as passing implementations or as proof that an existing package lacks support. This corpus supplements the larger per-language acceptance suites, which already exercise more copied types and lifecycle behavior.

The fast suite rejects missing, duplicate and extra results, incorrect values, wrong profiles/modules, unmatched archive identities, missing runtime identities, incomplete recovery, unverified copies and attempts to reuse evidence across source paths. Synthetic observations are confined to validator tests and never enter the installed report.

Run the report checks with `npm run test:type-corpus`. Run real compilation and installation with `npm run test:type-corpus:python`; see the [prerequisites and commands](../contributing/testing.md#shared-real-lean-type-corpus). CI requires the installed suite, binds its outcome into the Python support observation and uploads `type-corpus-python-<commit>`. It does not upload the generated packages to a registry.

## Repository validation

The enabled corpus suite passes all 23 tests, including real compilation, four wheel builds and two isolated installations. `npm run check:core` passes lint, checked-JavaScript types and 731 tests; 54 compiler/runtime-gated cases skip in that fast run. The installed corpus runs separately as described above. All 65 documentation tests, 111 site/demo tests, the site typecheck, production site build and type-inventory check pass.

The preceding packaging milestone, `6e60d51`, also completed all three CI workflows successfully: core `35140046209`, downstream consumers `35140046747` and performance `35140046184`. VO 1240 is closed. VO 1217 remains in progress for the corpus work listed above.
