# Installed nominal WIT Subtypes

Producer: `9b39bd38db9165e95a948a6bbc8023409cc8b4ce`.
Archive: `docs/evidence/nominal-subtype-wit-20261013`.
Index SHA-256:
`760dc281a804a238af123a2b1e1a4d5f3acdbacf6598b6518fb2922fcfec2e2e`.

## Executed acceptance

All four ordinary/reviewed, full/result-only selections passed with one test,
zero failures and zero skips each. Each selection reproduced its complete
package from two independent Lean author roots. The producer removed those
roots before installation, compiled one independent public C caller, and
removed the caller source and compilation tools before execution. It then
moved the installed tree and ran the identical caller again.

The eight executions completed 54,240 checks, 4,132 native/refinement refusals,
68 host refusals and 120 snapshot controls. The full API has 26 exports;
the standalone result-only API has 13. The fixture covers exact 100-bit Nat
values, nominal records and variants, aliases, nested containers, distinct
per-site constructors, normalization, mixed Fin ordering, unchanged inputs,
late rejection/recovery and result lifetime after session removal.

Calls cross the actual Component Model adapter into the packaged native Lean
host. The prepared package requires that host; it is not a standalone WASI
command. These runs used Linux x64, glibc 2.36 and Wasmtime 42.0.1, with an
explicit package floor of glibc 2.36. Other primitive bases and transports,
hosted glibc 2.38 acceptance, and constructor/source-entry counts remain
separate work.

## Original failures

The first ordinary/full attempt reproduced its package but stopped before
compiling the caller. Its harness expected functions directly on the WIT
world. The compiled component exports an interface containing those functions.
The next commit fixed the assertion to inspect the compiled JSON interface.

The next ordinary/result-only attempt completed both builds and caller
compilation, then stopped before execution because free disk fell below the
existing 2 GiB floor. After recoverable cleanup, a fresh run passed. Neither
failed attempt contributes an accepted execution. Their original records
remain in the archive.

## Retained records

The archive contains 607 files plus its index. It retains original reports,
commands and output, package/source/runtime receipts, all non-binary package
members, the compiled component and caller binaries, both author snapshots,
47 producer source files, nine checker sources and the batch launcher.

The archiver authenticated every member of each complete original package.
The complete archives and native libraries remain in the build handoffs.
The small component supplements were copied from those archives without
regeneration. The checker restores the complete 20-module WIT generator
closure from the producer revision and compares its generated members with
the originals.

The producer verified unchanged fingerprints for all 5,541 captured source
inputs after each selection. The batch launcher did not record its own
pre-launch hash or the full ambient environment. Tool records identify the
selected commands and pinned Wasmtime C API files. Compiler and operating
system distributions remain trusted inputs.

Packaged generated sources remain installed. Lean author/build roots and
the consumer's compilation inputs were removed. Both executions use the
exact archive-owned file set and a compiler-free environment; the executable
has an origin-relative library search path.

## Verification

The independent checker accepts all four original reports and rejects 974
missing-record, corruption and coordinated semantic changes. Those controls
cover constructor decisions, generated sources, package closure, tool
identities, resource floors, compilation commands and relocated executions.
The registered archive tests also check each retained byte, the failure
records and complete zero-skip TAP.

Run the archive tests with:

```sh
node --max-old-space-size=3072 --test --test-concurrency=1 \
  tests/helpers/nominal-subtype-wit-evidence-tests.mjs
```

This milestone changes no production adapter, support inventory or workflow.
Required recurring WIT acceptance and exact support/documentation promotion
follow this archive.
