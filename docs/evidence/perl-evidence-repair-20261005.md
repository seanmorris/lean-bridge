# Perl live-receipt evidence repair

The `e7c6626` repair taught the JVM and Perl execution verifiers to separate a
fresh compiler invocation from the frozen semantic fixture. It missed two Perl
verifiers: the CPAN package evidence reader and the optional-capability variant
reader. [Consumer run 37317108353](https://github.com/seanmorris/lean-bridge/actions/runs/37317108353)
at `e7c6626b12371e56aeb3cd89109e345e249259e1` failed in both. Each one compared
the complete fresh metadata and source identity with hashes pinned from the
original acceptance run.

This repair changes evidence readers only. It does not add a supported type,
change generated production code, or alter any recorded receipt or pin.

## Cause

The `Fin` refinement work changed `src/analyze/NativeExports.lean`. A fresh
compiler invocation therefore records a new extractor digest and a new derived
invocation identity, even when every selected declaration is identical. The two
readers hashed that whole input directly:

| Reader | Fresh digest | Pinned digest |
| --- | --- | --- |
| Package, ordinary combined metadata | `2dc8e660…` | `3915cd85…` |
| Variant, ordinary no-host metadata | `3535913b…` | `1ea05338…` |

## Why the rebased identity is authorized

Both readers now follow the pattern the runtime and sanitizer verifiers already
use:

1. The observed producer invocation hash must equal the invocation hash in the
   recorded metadata request.
2. `callbackCompilerInputAtBaseline` must authenticate the observed extractor
   digest as the reversal of the current extractor source through its exact
   source history. Arbitrary extractor digests fail.
3. On a copy of the input, only the extractor digest and the request and
   invocation hashes derived from it are rebased to the fixed baseline extractor
   `9d39776b…`.
4. The rebased metadata and source identity must still match the original pins.
   Declarations, interfaces, diagnostics, selections, modules and
   configuration are all covered by those pins.

The model, manifest, archive and installed-run checks still use the observed
input, so the report is never overwritten. Historical reports already carry the
baseline extractor and pass through unchanged.

The baseline helper now accepts the verifier's source reader. Authenticating a
historical run through a recorded source reader therefore never reads the
current working tree implicitly. Existing callers keep the filesystem default.

## Source history

`docs/evidence/perl-evidence-repair-source-history-20261005.json` records the
exact transition of each of the nine changed files from their
`4affa1bcf6727a550db59ab845394f425cc26882` bytes. These are eight verifier
files plus the three source-evidence pins in `docs/type-surface.v1.json` for
`tests/component-array-contract.test.mjs`, which now imports the new history
test. No type-surface support claim changes. The layer is chained ahead of
the callback `Fin` history, so older verifiers that authenticate these files
can still reconstruct their recorded predecessors. Unknown edits still fail.

## Verification

The authentic reports come from artifact `11354654272` of the run above. Only
the needed report entries and variant handoffs were read, using HTTP range
requests, and each passed its ZIP CRC check.

| Check | Before | After |
| --- | --- | --- |
| Package evidence: four producers and 32 installed runs | fails at the metadata pin | passes |
| Package evidence: coordinated forgeries | 284 rejected | 284 rejected |
| Variant evidence: eight producers and 64 installed runs | fails at the metadata pin | passes |
| Variant evidence: coordinated forgeries | 438 rejected | 438 rejected |

Before the repair, the pin comparison rejected the authentic reports
themselves, so the positive reconstruction could not pass and the forgery
counts could not distinguish real defects. After it, the positive
reconstructions pass and the same forgeries are still rejected. The pin
failure therefore no longer masks the suites. These counts do not show which
independent check rejected each forgery. The tamper tests assert rejection,
not specific failure reasons.

The complete `test:owned-perl-callback-evidence` CI step, run against all of
that artifact's reports, has 16 tests, and all 16 pass. One reviewed
combined-release test reached its 300-second limit while the machine was
heavily loaded. Rerun alone, it passed in 139 seconds, against 142 seconds in
CI. The historical Perl, PHP-Wasm, WIT and post-Perl staging history tests
pass 22 of 22 against the committed evidence.

New unit tests check four things:

- the injected source reader is the one used;
- a forged extractor source is rejected;
- coordinated declaration, interface or selection edits with consistent
  invocation hashes miss the original pins;
- the source-history layer reconstructs every predecessor exactly.

No registry publication, gate removal or type-surface support promotion belongs
to this repair.
