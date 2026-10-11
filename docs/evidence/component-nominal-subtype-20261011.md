# Public component Subtype admission

The component compiler now accepts per-use constructor choices in acyclic copied plain records and variants. Aliases and structural containers retain those choices. Input Subtypes require a checked constructor; Lean-produced results can project their payload without choosing a constructor.

Public metadata, compiler-plan schemas and typed validation retain field order, case order, exact nominal identities and result direction. ABI selection checks the original Binding IR before flattening its definitions into private graph layouts. Generic-record provenance, erased proof fields, ownership and callbacks cannot bypass those checks. Shared nominal and callback refinements remain Fin-only.

The shared mirrors from `66639dd` now receive these public plans. The generated C frame checks every argument's Fin bounds before invoking any selected constructor or source function. Generated JavaScript follows the active variant case, checks nested bounds before calling the runtime, and does not normalize Subtype inputs itself. JavaScript boundary tests use a counted mock runtime; they do not measure Wasm or Lean entries.

## Fresh compiler checks

The nominal fixture passes ordinary, reversed and independently reviewed source routes for both native and component profiles. Each component route compiles 30 Lean assertions, for 90 total. Each native control compiles 23 assertions and its C/C++ surfaces. Both profiles reject all 24 malformed or invalid source selections, including unsafe, partial, foreign and admitted constructors. Two valid constructors map the same input `40` to `41` and `42` at their respective use sites.

The constructor-free result fixture passes ordinary, reversed and independently reviewed routes with 13 exports, plus a 15-export mixed reviewed package. Its component routes compile 69 further assertions; native controls compile another 69 and their C/C++ surfaces. Scalars, containers, aliases, records, variants and empty cases retain their payloads. Missing input constructors and unsupported callback, generic-record, recursive and checked-record combinations remain rejected.

Across the two fixtures, 159 component assertions and 138 native assertions pass. The compiler extractor SHA256 is `a6e5738d497fa57e2ff7eb98d2da7761277dc72c6584802909c3a4960c6ee6f3`.

- Nominal report: `build/vo1444-component-nominal-source-r1/report.json`, SHA256 `fc9a88b488bd9c7efa52b3b343bba257b1b22799022149efc10593232b3d7bf1`.
- Result report: `build/vo1444-component-result-source-r2/report.json`, SHA256 `cd59b1bfd5bcc5fde57947235a6e703aa29dc40fb808e0b84aca2af5fbedd0f3`.

The first result attempt failed because a test assertion omitted an `Except Nat Nat` annotation. R2 adds that annotation and passes the full result check. The combined R1 TAP retains that failure; it is not a successful two-fixture run. Result R2 also limits Lean itself to one worker. Both runs used one CPU at nice 19 and idle I/O priority.

## Regression and remaining acceptance

The final focused public-plan, metadata, JavaScript, mirror, callable, documentation and source-history regression passed 141 tests with no failures and 12 explicit compiler gates skipped. TAP: `build/vo1444-component-nominal-regression-r1.tap`, SHA256 `edc36da78a01034038455414872ca6379d2561f36f943b40f00df315cefad84c`. The source checks above execute the new compiler gates separately. Result R2 TAP SHA256: `3cdf9622249ef7d77878103d28325d323d63120b34d5ac644dcc133e2dd4bca5`.

Targeted lint, checked JavaScript types and all 16 generated references pass. Four previously supported JavaScript fixture packages remain byte-identical. Regenerating all seven component plans and assertion-bearing source files from the final generator matches the exact compiled bytes.

The source-history ledger records 20 exact transitions from `aca7821c8b7b9f52363fbd00ee8b6400baea52dd` and refreshes 315 current-source pins only. Its SHA256 is `840e63b44413abf2a79a6e02597ed3acb93467f94feaddf3b04f742af3e42d17`. All 472 existing evidence entries, 571 observations and installed-support claims remain unchanged apart from those pins. The author guides mark nominal fields and constructor-free results as generated, with installed acceptance pending.

Next acceptance requires ordinary and independently reviewed packages reproduced from two roots, removal of the author tree, offline installation, installed-tree relocation and unchanged consumer replay. This includes native targets, CPAN, Node/strict TypeScript, browser/React/worker contexts and PHP-Wasm. Callback, owned, recursive and broader generic Subtypes remain part of #1444; this compiler milestone does not close that task or #1220.
