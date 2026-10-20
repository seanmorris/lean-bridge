# Complete checked-record value-index matrix

The public type inventory now binds top-level copied checked-record parameters and results with closed `Bool`, `String`, and `Nat` indices to retained hosted packages in all 17 consumer profiles. This final promotion adds C and C++, .NET, and Java and Kotlin to the previously promoted npm/browser, Perl, native PHP, PHP-Wasm, Python, Ruby, Rust, and WIT/WASI lanes.

Each lane retains four independently checked routes: ordinary source and reviewed Binding IR, each as a full package and a standalone result-only package. Full packages validate eight indexed inputs, preserve rejected caller values, recover on the next valid call, and return eight proof-free records. Result-only packages expose those results without carrying checked-input constructor metadata. Across the five profiles completed here, the promotion changes exactly 20 parameter/result inventory cells; the complete 17-profile matrix contains 68 such cells.

## Retained hosted runs

- C and C++: run `39287533848`, artifact `12205716190`, with C11/GMP and C++20 callers and complete native package archives.
- .NET: run `39134609046`, artifact `12139408925`, with the complete NuGet package, offline restore, relocation, and source-free replay.
- Java and Kotlin: run `39213054169`, artifact `12169642246`, with the complete Maven package, independent typed consumers, relocation, and source-free replay.

Every archive has a canonical index that hashes all retained files, the original artifact, source closures, package receipts, reports, TAP streams, runtime facts, and hosted API records. The promotion checker replays the archived route checkers before changing the public inventory and refuses missing, reordered, repeated, or forged references.

## Boundary

Indices remain authenticated compile-time metadata; they do not become host fields. The retained fixtures cover both Boolean values, `"ab"`, the empty string, `"λ🌱"`, zero, and `340282366920938463463374607431768211457`. This evidence covers top-level copied parameters and results only. It does not promote fields, callbacks, owned positions, open or opaque indices, other index kinds, value-carrying dependent payloads, or zero-payload checked records.
