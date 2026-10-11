# Installed structural Subtypes in Perl

Ordinary-source and independently reviewed CPAN packages passed at producer
`bbf659d51a97732d3f32c8a8e1add1fa502af88a`. Both runs used Linux x86-64 with
the declared local glibc floor of 2.36.

| Author route | Installed test | Duration | Lowest free disk |
| --- | --- | --- | --- |
| Ordinary source | 1 passed, 0 failed, 0 skipped | 316.8 seconds | 9,372 MiB |
| Reviewed API | 1 passed, 0 failed, 0 skipped | 312.9 seconds | 9,366 MiB |

Each route built identical runtime and component archives in two independent
author directories, then removed both author/build trees before installation.
The prepared packages contain all four supported Perl ABIs: 5.36.3 and 5.38.2,
each with threaded and unthreaded builds. The harness probes the actual
interpreter version, threading, integer width and pointer width, and records
the executable hash.

Every ABI passed both `prebuilt-only` and `build-xs` installation. The latter
compiles XS glue from the prepared distribution, without rebuilding Lean.
Both modes run the installed caller with no compiler or Lean executable on
PATH. The harness removes extracted distributions before execution, moves the
complete installation, and replays the unchanged caller from its new location.
It checks every installed file before and after both executions, including
the shared-runtime dependency, installation receipts and native payloads.

The 32 retained execution transcripts each passed 4,119 checks, including
1,042 expected rejections and six snapshot mutation controls. The twelve
exports cover Array, List, Option, products, result branches, transparent
aliases and a closed generic specialization. Cases include arbitrary-precision
Nat values, UInt8, Unicode and embedded-NUL suffixes, empty and absent values,
first/middle/last rejection and all nine nested row/column positions.

The caller checks mixed-Fin priority, separate constructor choices for alias
sites and parameters, and exactly-once normalization. It compares independent
snapshots of complete inputs after rejection and successful normalization,
including mutable `Math::BigInt` values, through 1,000 late rejection/recovery
pairs. Perl errors must contain the exact expected cause followed by one
source location. Arbitrary suffixes, extra newlines and wrong locations reject.

Independent synthetic controls run both callers on all four ABIs. Each detects
eight deliberately faulty APIs and twelve malformed diagnostics. These controls
test the caller, not Lean execution. Separate source-generation tests check
XS validator ordering, scalar transport and nested diagnostic paths against
authenticated semantic models. The installed runs above exercise the real
generated module and compiled Lean library.

## Original records

The archive is
[`structural-subtype-perl-20261011`](./structural-subtype-perl-20261011/index.json).
It retains 255 originals plus its index: 224 run records, 29 exact producer
source snapshots, the runner and the report checker. Index SHA-256:
`5809c2236f123b9bebb1a4ab8d7cc28b5ecdbbca2eb5be9c9706cc2848238030`.

Ordinary TAP SHA-256:
`8fec8d3ad5b6a762550e1e8dc1c02cc8652984cc40858656906d6aa23c483e00`.
Reviewed TAP SHA-256:
`6abd699c0b09e680cb1d372ed9138a55ac6694a9ef4ca00f7eb8043404d6fde6`.

The checker reconciles both models with the independently authored API,
constructor selections and frozen Lean source. It checks all ABI/mode entries,
prepared runtime identities, installation traces, installed file hashes,
caller bytes and original output counts. Historical absolute paths remain
provenance; the checker never reopens them.
Generated XS snapshots retain their original whitespace, including trailing
spaces, so their hashes continue to match the prepared package manifests.

All three archive tests passed. They reject 512 missing/corrupted originals
and 76 coordinated report/package mutations, including missing matrix entries,
changed source or constructors, false isolation, substituted ABI identities,
changed native payloads and reduced assertion counts.

An independent audit compared every archived original with its producer,
including all 29 source snapshots from Git. All 8,550 older evidence files and
the complete 440-claim/555-observation support inventory remain unchanged.
The source regression passed 58 tests, failed none and skipped twenty explicit
compiler/installed gates. Full repository lint, targeted checker lint, type
checking, sixteen generated references and all 43 documentation tests passed.
The initial draft regression exposed an incorrect new POD-heading assertion;
it was corrected before the producer commit. Neither installed run failed.
The final five-root regression passed 61 tests, failed none and skipped twenty
explicit compiler/installed gates. The final documentation run passed all 43
tests without skips. These skipped gates are separate from the two successful
installed producers and their 32 retained executions above.

## Remaining acceptance

This archive establishes local glibc 2.36 acceptance. Hosted glibc 2.38,
constructor/source entry counts and memory behavior are not measured here.
Package binaries and full toolchain closures are not retained. Support-table
promotion and recurring structural CI remain separate work.

Perl completes the native structural-Subtype acceptance pass. Browser pages,
React, workers and PHP-Wasm remain. Before fresh JavaScript/browser acceptance,
the current JavaScript caller needs a type-tagged snapshot: its bigint-to-string
JSON replacement can miss a string returned in place of a bigint. That gap was
reproduced with a faulty mock, not with the generated runtime. Existing npm
evidence remains unchanged. Broader nominal, callback, owned and generic
combinations remain within VO #1444 and #1220.
