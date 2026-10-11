# Installed structural Subtypes through WIT

Ordinary-source and independently reviewed WIT packages passed at producer
`3a9cea971aca9cae52900abdd5d705e1b9d41adf`. The runs used the pinned Wasmtime
42.0.1 C API and wasm-tools 1.245.1 on Linux x86-64 with the declared local
glibc floor of 2.36.

| Author route | Installed test | Duration | Lowest free disk |
| --- | --- | --- | --- |
| Ordinary source, R2 | 1 passed, 0 failed, 0 skipped | 121.0 seconds | 9,971 MiB |
| Reviewed API, R1 | 1 passed, 0 failed, 0 skipped | 117.3 seconds | 10,026 MiB |

Each route reproduced its model, package-set receipt and archive in two
independent author directories. The harness removed both author/build trees
before installing the prepared archive. It compiled only a downstream C caller,
validated the Component Model binary and authenticated the installed package
against the original archive before compilation and around execution.

The caller uses the generated `structuralsubtypes_wasmtime` session API. Calls
cross the embedded Component Model adapter into the compiled native Lean library.
This package requires its native host; it is not a standalone WASI command.
The installed package supplies Wasmtime, the host adapter and the Lean runtime.
Consumers do not install Lean.

The four retained execution transcripts cover both author routes before and
after physical relocation. Each passed 9,262 assertions, including 1,042 expected
rejections and twelve independent snapshot mutation controls. The installer also
ran the same caller before preparing its relocatable executable. The executable's
ELF runtime search path is exactly
`$ORIGIN/structuralsubtypes-1.0.0-wit-wasi/lib`, without an old-root fallback.
Both caller and executable bytes remained unchanged through relocation.

The twelve exports cover Array, List, Option, products, both result branches,
transparent aliases and a closed generic specialization. Cases include full
arbitrary-precision integer limbs, UInt8, Unicode and NUL suffixes, empty/absent
values, first/middle/last failures and all nine nested row/column positions.
The caller checks mixed-Fin priority, independent alias/parameter constructors
and exactly-once normalization. It compares every active public value payload
before freeing either input, checks the unchanged output sentinel after each
rejection, and completes 1,000 late rejection/recovery pairs. A copied result
also survives input mutation and session closure.

## Diagnostic correction and original records

Ordinary R1 at `7a1b8ac` failed because the new test caller expected no final
newline in Wasmtime's formatted error chain. The underlying constructor rejected
the expected input with the expected cause. Commit `3a9cea9` corrects the test
parser to accept one final newline within the recognized backtrace wrapper.
Bare causes still require byte-for-byte equality. Extra suffixes, multiple
causes, embedded NULs and additional final newlines reject.

Both callers compile against the genuine generated header. A separate source
control executable passes twelve snapshot mutations and twelve diagnostic cases
using the real Wasmtime value API.
A separate diagnostic replay of the corrected caller against the retained R1
package passed all 9,262 checks; this replay is not counted as fresh installed
acceptance. The ordinary R2 run above rebuilt both author roots independently.

The archive is
[`structural-subtype-wit-20261011`](./structural-subtype-wit-20261011/index.json).
It retains 93 originals plus its index: 58 successful/failed run records,
33 exact Git source snapshots, the runner and the report checker. Four source
snapshots and twelve records belong to the failed attempt. Index SHA-256:
`c630598ad8ecedce13f1bc7b469dc416ff615d53cd8c82486c5c98b15280ba9f`.

Successful ordinary TAP SHA-256:
`bbff229f2a9ddebe41a46597df52d3d0d51a8e9b64275b9ba83b5b1702a5368f`.
Reviewed TAP SHA-256:
`5b15394ac21d09b5819e93e39a94239f1e841a71b8f45daa9c075f5d342985c7`.
Failed ordinary R1 TAP SHA-256:
`9d4e87cce3aa139a94de211061c144bc2c5966a0097d9497a02eebbbb4759835`.

The checker reconciles both original models with the independent API and
constructor choices. It authenticates caller bytes, WIT/WAT, the component
binary, public header, manifests, Wasmtime identities, pkg-config metadata and
replay observations. Historical absolute paths are provenance only; the checker
does not reopen them.

Three archive test groups passed, rejecting 188 missing/corrupted originals and
60 coordinated report/contract mutations. Controls include old-root search
paths, false relocation/isolation, missing libraries, changed WIT signatures,
component versions, altered counts and constructor choices, and substituted
Wasmtime versions or library hashes. Transport controls coordinate their file
identities, adapter records, package receipts and observation hashes.

An independent audit compared every archived original and source snapshot with
its producer. All 8,455 older evidence files and the complete
440-claim/555-observation inventory remain unchanged. The source five-root
regression passed 49 tests, failed none and skipped eighteen explicit
compiler/installed gates. Full source lint, final targeted lint, type checking
and sixteen generated references passed. The initial draft regression failed
on a duplicate local variable in the uncommitted harness; the final source run
above follows that correction.
The final five-root regression passed 52 tests, failed none and skipped eighteen
explicit compiler/installed gates. Those skips are separate from the successful
source compilation and installed runs above. The documentation root passed all
43 tests without skips.

## Remaining acceptance

This is local glibc 2.36 acceptance, not a hosted glibc 2.38 observation. The
Component Model binary is retained; native package binaries and full toolchain
closures are not. Constructor/source entry counts and memory behavior were not
measured for these packages. This milestone does not promote support-table cells
or add recurring structural WIT CI.

Perl remains in the native structural-Subtype pass, across all supported ABIs
and both installation modes. Browser page/React/worker and PHP-Wasm are additional
environments. Required recurring gates, support-table promotion and consumer
documentation follow acceptance. Nominal fields, callbacks, owned values and
broader generic combinations remain within VO #1444 and #1220's original scope.
