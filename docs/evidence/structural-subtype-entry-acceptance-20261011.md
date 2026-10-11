# Structural Subtype constructor and dispatch observations

The ordinary and independently reviewed entry probes use producer
`95c0e59cbd995dd83ea849940768a4ef5615a69c`. Each probe adds sixteen reversible
`noinline`/`export` annotations to the original fixture and appends one
unrefined control. Removing those annotations and the control restores the
original source exactly. These measurements describe that separate probe,
not dispatch in an unmodified release.

The observer interposes 59 public, validator, constructor, adapter and source
symbols. Its signatures match the generated GMP header and compiled Lean
carriers, including `uint8_t` validator returns and the unboxed UInt8
constructor parameter. The closed generic specialization calls its actual
`l_StructuralSubtypes_generic___redArg` worker.

Each installed replay checks all 2,037 public calls from the unchanged C
consumer, with 4,049 value/error/input-preservation assertions and 1,000
late-rejection/recovery pairs. Independent expectations specify the sequence
of entries for every call. The public corpus observes 9,057 validator entries,
14,086 constructor entries, 1,017 adapter entries and 1,017 source entries.
Mixed Fin rejection occurs before any constructor, adapter or source entry.
Normalization results still match the original consumer expectations.

Eleven direct-adapter cases cover valid arrays, alias arguments and nested
inputs, first/middle/last Subtype failures, and mixed Fin rejection. Raw calls
bypass public pre-validation; adapter construction still rejects invalid inputs
before source entry. A raw mixed-Fin rejection can invoke a preceding Subtype
constructor. Public precheck ordering is not claimed for raw calls.

Every selected identity has a nonzero positive control. Running the unrefined
control without the observer succeeds as a value check but fails trace
verification. The source tests also refuse missing markers and fabricated
type-table entries.

## Installed acceptance

Both selections passed one installed test with zero failures or skips:

- Ordinary: 379.5 seconds. TAP SHA-256
  `53d4b3073f7ebafb08ce531168b5a06ccab848e304d1dbfb1a665539aa2d2bf0`.
- Reviewed: 385.3 seconds. TAP SHA-256
  `e0ef7fb56af10f18db3c78eff5d45cc385e8bad26cdec653378568180a870e08`.

The one-second disk guards recorded minima of 10,465 and 10,457 MiB.
Neither run triggered the disk stop.

Both author/build trees are removed before offline installation. After the
first execution, the harness moves the complete installed tree and replays
the unchanged caller, observer, control and raw driver. It compares package
files with the original archive before and after both executions and checks
all observer/caller/executable hashes. Local runs declare glibc 2.36.

## Original failed attempt

The first ordinary run at `3012902` passed the complete public corpus and
four raw array cases, then failed while resolving an alias carrier. The raw
driver read a nonexistent parameter-tree `key` and requested
`lb_tundefined_some`. The correction resolves `nativeTypeKey(type)` against
the compiled model's actual type table. It does not change production code.

The failed attempt's TAP, partial observations and producer sources remain
separate from successful acceptance. Its TAP SHA-256 is
`4382a48038c177754365829c2d842a400a28faf677518450af2c09b78e0ccb0d`.

## Archive and regression checks

[The archive](structural-subtype-entry-20261011/index.json) retains 149 records
and selected sources, plus its index. It includes the failed first attempt,
both successful routes, 23 successful-producer source snapshots and three
failed-producer snapshots. Index SHA-256:
`e4945cf2c16e426444523fd70b6f5275f53d1d5a9e17ae4cff0b2e1fc335565f`.

Test discovery exposed eight missing structural-Subtype root registrations
before push. All eight now belong to the contract profile; installed producers
retain explicit environment gates. The new registration history records four
exact transitions and refreshes 94 current-source pins, without changing any
support claim or earlier evidence file.

Three regression selections passed 156 tests, with zero failures and 34
explicit compiler/installed-gate skips. The actual ordinary and reviewed
installed runs above each passed without skips. Archive controls rejected 300
missing/corrupted originals and 54 coordinated report, trace and source changes.
Full lint, checked JavaScript and all sixteen generated-reference checks passed.
An independent audit compared all 149 archived files with their originals and
confirmed that all 7,814 earlier evidence files and 440 support claims stayed
unchanged. The registration ledger SHA-256 is
`dc24edb537149f8990b43e68b10d18883bd6e62763e0539ce0a154d623e2f5a6`.

The checker reconciles source annotations, independent author configuration
and review, two reproduced models/receipts/archives, exact observer sources
and compiler arguments, public traces, raw calls, controls and relocation
records. Compressed traces retain both original and compressed hashes.
Historical absolute paths identify the original run; archive readers never
reopen those paths.
Original generated observer files retain their trailing whitespace so their
archived bytes match the executed sources.

Memory use, other hosts and unmodified-release dispatch remain unmeasured.
Package binaries and complete toolchain closures are not archived. This
milestone does not promote support-inventory cells or add installed CI gates.
