# Structural Subtype installed Python acceptance

Producer `f68b3200138e475bc605bd692e6ad06be57390a6` supplies independent Python
callers for the twelve structural Subtype exports. The ordinary author names
constructors in export configuration. The reviewed author supplies an
independently written Binding IR, which fresh Lean analysis reconciles with
the source. Both routes use the original unannotated Lean fixture.

Each execution checks:

- 4,119 assertions, including 1,042 expected rejections.
- Array, List, Option, Prod and Except values, aliases and a closed generic
  specialization, with Nat, String and UInt8 checked constructors.
- Empty and absent values, both active result branches, first/middle/last
  invalid elements, and all nine positions in a nested 3×3 structure.
- Exact constructor names and failing paths, plus mixed Fin rejection before
  the Subtype error. Python source-entry counts are not measured.
- Values above 64 bits, Unicode and embedded-NUL suffixes, and independent
  normalization at alias sites without modifying caller inputs.
- Complete snapshots of both inputs through 1,000 late-rejection/recovery
  pairs. Six deliberately changed snapshots prove the comparison detects
  changes in either input, lengths, tags, numeric payloads and NUL suffixes.

Source controls run the caller against an independent Python model and reject
eight deliberately broken behaviors. Those controls are separate from the
actual installed Lean executions below.

## Installed runs

All four installed selections passed one test with zero failures and skips:

| Interpreter | Author route | Duration | Minimum free disk |
| --- | --- | --- | --- |
| Python 3.11.16 | Ordinary | 132.6 s | 10,483 MiB |
| Python 3.11.16 | Reviewed | 134.8 s | 10,430 MiB |
| Python 3.12.14 | Ordinary | 144.5 s | 10,473 MiB |
| Python 3.12.14 | Reviewed | 125.2 s | 10,471 MiB |

The one-second disk guard did not stop any run. Original TAP SHA-256 values:

- 3.11 ordinary: `d273a87be35279dc48c1264bcea64791498dcf9f077e0c83c01127e60b095a1c`.
- 3.11 reviewed: `f2706879d2b00f63581d6cafbd402806106013dca165bc34361525c418ca7850`.
- 3.12 ordinary: `1492d09520a51c16a811c0a20faf2958b2ac88b9cd525d3e83f3164fc70b09c3`.
- 3.12 reviewed: `bb268bd73ee4edb3bed98b115d58959df8ff205d8b681f04d0462a95af595297`.

Every selection independently reproduces the model, package-set receipt and
wheel from two author roots. The harness deletes both author/build trees before
offline pip installation with dependencies, cache, compilation and network
package lookup disabled. Consumers run with isolated imports, normal site
initialization, an empty bytecode prefix and no compiler on PATH.

The installer records a fresh venv before installing the wheel and admits only
the receipt-authenticated package files plus named pip metadata. It checks the
interpreter bytes and full venv inventory before and after execution. The
harness moves the entire installed consumer tree, checks the unchanged caller
and inventory, and runs the same checks again. Ordinary wheels match across
Python versions, as do reviewed wheels. The two author routes retain their own
package identities.

## Original records and verification

[The archive](structural-subtype-python-20261011/index.json) contains 88
original records and selected sources, plus its index. It preserves four
complete runs, 23 selected producer-source snapshots, the runner and queue,
and the independent checker. Index SHA-256:
`bb5b20b3a8abe1e475f1526b83e36841e0f4bfe2a482a3edc08d5e38d63fd5d3`.

The report checker verifies exact source and constructor contracts, compiler
identities, two-root models and receipts, the selected Python minor, original
caller bytes, execution counts and full installed-environment hashes. It never
opens historical absolute paths. Archive tests refuse missing or corrupted
records and coordinated changes to reported isolation, interpreter selection,
constructor choices, package files, counts and relocation.

The registered seven-root regression passed 38 tests with zero failures and
seven explicit compiler/installed-gate skips. The separately enabled installed
runs each passed without skips. Focused archive checks passed three tests and
rejected 178 missing/corrupted originals and 96 coordinated report/contract
changes. Full lint, final changed-file lint, checked JavaScript and all sixteen
generated references passed. An independent audit compared all 88 archive
files with their originals and confirmed that 7,966 older evidence files and
the entire type-support inventory remain byte-identical.

These are local Linux x86-64 runs with glibc 2.36. No hosted release-floor,
Python entry-count or memory claim follows. Package binaries and complete
toolchain closures are not archived. Support promotion, recurring installed CI
and the remaining structural host/browser/PHP-Wasm/Perl acceptance are separate
work in #1444.
