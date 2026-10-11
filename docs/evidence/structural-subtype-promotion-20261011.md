# Installed structural Subtypes

Both ordinary-source and independently reviewed packages execute checked
Subtype inputs and results inside `Array`, `List`, `Option`, products and
`Except` across all seventeen consumer profiles. The installed fixtures also
cover transparent aliases, different constructor choices at different sites,
mixed `Fin` bounds and one closed `List` specialization.

The support inventory supplements 25 existing observations, representing 68
already-passing parameter/result cells. It adds 24 references to original
installed runs. This changes the documented scope of those cells; it does not
turn an unaudited field or callback cell into a passing one.

## Original installed evidence

Every archive below retains both author routes, the original TAP, start/end
records, compiler reports, selected producer sources and package digests.

| Consumer | Archive | Runtime coverage |
| --- | --- | --- |
| C and C++ | [Native](structural-subtype-native-20261011/index.json) | Both public APIs; original TAP has three tests per route |
| Python | [Python](structural-subtype-python-20261011/index.json) | Python 3.11.16 and 3.12.14, separately executed |
| Rust | [Rust](structural-subtype-rust-20261011/index.json) | Installed Cargo consumer |
| Ruby | [Ruby](structural-subtype-ruby-20261011/index.json) | Installed gem consumer |
| C# / .NET | [.NET](structural-subtype-dotnet-20261011/index.json) | Installed NuGet consumer |
| Java and Kotlin | [JVM](structural-subtype-jvm-20261011/index.json) | Both public APIs |
| Native PHP | [PHP](structural-subtype-php-20261011/index.json) | Weak and strict callers |
| WIT / WASI | [WIT](structural-subtype-wit-20261011/index.json) | Installed Component Model consumer |
| Perl | [Perl](structural-subtype-perl-20261011/index.json) | Four pinned ABIs, prebuilt-only and build-XS installation |
| Node, TypeScript, pages, React and workers | [npm/browser](structural-subtype-browser-20261011/index.json) | Node/strict TypeScript and Chromium, Firefox, WebKit |
| PHP-Wasm | [PHP-Wasm](structural-subtype-php-wasm-20261011/index.json) | Twelve Node/Chromium distribution, loading and strictness contexts |

The fixtures use `Nat`, `String` and `UInt8` Subtype leaves. Each present leaf
uses the selected checked Lean constructor. Normalizing constructors change
the value seen by the export without changing the caller's input. Rejected
values fail, and repeated valid calls after rejection still succeed. Results
project the proof-backed base value. Empty containers, absent options and
inactive branches do not require a fabricated refined value.

The runs reproduce packages from two author roots and remove author/build
sources before offline consumer installation. Native and PHP-Wasm runs replay
unchanged consumers after moving the installed tree. The npm archive records
Node relocation separately from source-free browser bundles. Browser checks
include React lifecycle changes, worker restart and failure recovery. The JS
mixed nested fixture tests one invalid position; the native and PHP callers
test all nine. Their coverage is not interchangeable.

## Evidence verification

`tests/helpers/structural-subtype-promotion.mjs` authenticates every archive
index and original file, compares selected source snapshots with the producer
Git revision, and runs the existing host-specific report validators. It checks
the original TAP selection, including the three-test native runs, rather than
substituting the CI runner's one-test selection. Historical absolute paths are
provenance; verification reads archive-relative files.

The registered promotion tests reject missing/corrupt originals, changed
routes, runtime/profile omissions, duplicate selections and broader support
claims. The [source-history ledger](structural-subtype-promotion-source-history-20261011.json)
records exact transitions from `e844290c9bc4eb1052dcbce6e730f96e59165990`.
Earlier evidence and unrelated observations remain intact. The
[required CI workflows](structural-subtype-ci-workflow-20261011.md) run both
author routes across twelve host lanes and retain failure artifacts.

The same milestone corrects an obsolete assertion in
`tests/elaborated-metadata.test.mjs`, reproduced from hosted Perl shared-compiler
job `114460015184` at `fb99dda`. The old test expected `Array Subtype` metadata
to fail after structural support had been implemented. The replacement checks
all five structural constructors and aliases at input and result sites,
requires intact metadata and schema acceptance, and rejects malformed
constructor names. Callback and nominal-field rejection checks remain.
No production admission rule or generated adapter changes in this repair.

## Remaining scope

These local installed runs do not establish hosted release-floor execution.
They retain package digests and selected sources, not the package binaries or
a complete toolchain/input closure. They do not measure memory or dispatch
counts in the unmodified release packages. The separately annotated C entry
probe has its own scope and does not establish counters in other consumers.

Subtype fields in nominal records/variants, refined callback signatures,
owned values, recursive types and broader dependent/generic combinations
remain open under #1220. These records do not close those requirements.
