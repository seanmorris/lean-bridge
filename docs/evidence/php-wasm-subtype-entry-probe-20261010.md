# PHP-Wasm Subtype entry probe

Producer: `6ac0d2bacfb0ff53b4698a5310f3f3e5e45ad5d3`. VO: #1443, #1220.

The ordinary, one-root probe executes the complete PHP Subtype caller in weak and strict mode. Each mode passes 2,024 assertions and records 2,030 public C calls, 2,029 validators, 3,045 constructor entries, 1,017 adapters and 1,016 source-function entries. Each transcript matches the independently specified call order, including all 1,000 invalid/valid recovery pairs. Both modes produce the same entry transcript.

Nine separate smoke calls include an unrefined positive control. Together, the corpus and smoke observe every one of the 55 selected C entry points. Rejected odd values enter the checked constructor once and enter neither the adapter nor the source function. A late string rejection enters both validators and constructors but no adapter or source. A failed Fin precheck enters none of those functions. Normalizing constructors produce the expected clamped or doubled result while the original caller checks that its input remains unchanged.

## Observation mechanism

The PHP-Wasm component exports only `get_module`. Zend invokes the C wrapper, validator and Lean adapter inside the side module. An exported-Wasm-function proxy cannot observe these internal calls.

The separate probe adds `noinline` and named export attributes to selected Lean definitions, then inserts entry markers into generated C function bodies. Each public C wrapper also has an end marker using the compiler's [cleanup attribute](https://gcc.gnu.org/onlinedocs/gcc-15.2.0/gcc/Common-Variable-Attributes.html). Original signatures, return statements and body bytes remain. Removing the recorded insertions restores each generated C unit byte for byte. The reusable marker helper reproduces all seven executed C units exactly.

Lean compiles the generic `Subtypes.echo` into a reduced-argument worker. Its adapters call `l_Subtypes_echo___redArg` directly, so that worker is the measured source entry. Marking only the exported wrapper missed those calls in R3. `zeroEven` is a constant: its adapter is measured, but no per-call source-function entry is asserted.

The parser requires complete call brackets and known marker identities. Tests refuse unexpected stderr, duplicate selection, missing markers, nested brackets, unbracketed entries, altered C spans and corrupted archive bytes. Exact expected call sequences reject empty or incomplete instrumentation even when the remaining trace parses.

## Retained records

[The archive](php-wasm-subtype-entry-probe-20261010/index.json) contains 112 files, including selected original/probe C units, commands, Lean sources, package identities, observers and complete transcripts. Index SHA-256: `ba04738bd1e155caafdcc4f2101a36258986be5cb166998d91ebe2d9efd7f051`.

Failed attempts remain unchanged. R1 had invalid Lean attribute syntax. R2 built, but `-finstrument-functions` required return-address support absent from the pinned PHP host. The first R3 reader mishandled newline-terminated stderr chunks. The first full-corpus driver evaluated a `strict_types` file through `php.run`; the corrected driver writes and requires the file, matching the normal installed consumer. R4 fixes the generic worker selection.

Original absolute paths identify where records were produced. Archive checks use repository-relative paths and do not require those producer directories in CI.

## Validation

Four-root regression: 182 passed, zero failed, 13 explicit compiler/installed skips. TAP SHA-256: `f58fb203881b48fda58004d8e4132c3e48b6a0c21b034c0d82dc48fda4ffaaee`. Final focused controls: 13 passed, zero failed or skipped; TAP `e0569ab4426d28724502b68a54b17fdb5a0d402a4609a67f2c8700c8787c9298`. Full lint, checked JavaScript, all 16 generated references and final changed-file lint pass.

The independent audit verifies seven exact Git-backed transitions, six source-hash updates, all 112 retained records and ten selected producer sources. It compares 5,158 earlier evidence files byte for byte. All 407 evidence claims and 509 observations remain unchanged. Audit SHA-256: `0363c5094d76b99782f4b2b6bc951eafda8d7fe8aa572fa5be923afe1721a761`. Source-history ledger: `21629834a6b9bde05f5ba26557bd016375c9e89470e4991179e1ea6c12ada84d`.

Two draft observer changes followed their archived snapshots: a lint-only declaration reorder and UTF-16-preserving masking of supplementary Unicode characters. The audit reverses those exact edits before comparing the snapshots. The first audit incorrectly expected the drafts to remain unchanged; its failed log remains under `build/vo1443-subtype-entry-independent-audit-r1.log`. Final unit controls cover the Unicode case and still reproduce every executed C input exactly.

## Remaining acceptance

These are instrumented probe measurements, not measurements of an unmodified release. This archive is not a complete compiler/toolchain closure. It does not establish two-root reproduction, source-removed installation, the independently reviewed route, browser execution or other loading arrangements. Those gates must run before claiming installed constructor-dispatch acceptance. Earlier unmodified-package reports and support claims remain unchanged. The nested, nominal, graph, owned, callback and dependent requirements of #1220 remain open.
