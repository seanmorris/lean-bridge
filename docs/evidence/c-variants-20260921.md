# Installed C and C/GMP tagged variants

VO1219 adds prepared C11 packages for concrete, non-recursive Lean inductives.
Consumers use named constructor constants and structs with named union payloads.
Generated `_init`, `_select` and `_clear` functions manage constructor lifetimes.
The [machine record](c-variants-20260921.json) retains both source paths for
plain C and C/GMP packages, their original archives and installed-file hashes.

## Public values and native conversion

The API uses names such as `VARIANTS_SIGNAL_KIND_DATA`, not Lean constructor
numbers. `_select` validates the requested tag, releases the old active payload
and initializes the selected constructor. GMP payloads use initialized `mpz_t`
values. Invalid selections leave the value unchanged. `_clear` restores the
initialized first constructor and tolerates repeated calls.

Typed Lean helpers construct, identify and read cases. The adapter does not
inspect compiler object tags or field offsets. Only the active variant payload
is read, converted or cleared. The existing 16 MiB conversion budget and
32-level type-depth limit apply. Result values own independent storage.

The public GMP layer rejects names that collide with its private C transport
before compilation. A regression test reproduced the missing rejection for
`GmpSignal`, `GmpStatus` and `gmpEcho`. Separate sanitizer checks switch
constructors 1,000 times, including a first constructor with GMP integer fields.

## Installed execution

The GMP fixture has fourteen exports, seven variants with eighteen constructors,
and a record containing variants. An additional Lean export round-trips both
`Buffers` constructors. Ordinary-source and independently reviewed builds each
pass 46,234 public assertions over 2,361 calls, including eleven rejection and
recovery cases. Coverage includes all nineteen primitive payloads, 5,121-bit
integers, fixed and platform-width limits, IEEE special values, Unicode, embedded
NUL, binary data, every constructor, nested records and containers. Lean checks
each scalar field independently, with eighteen changed-field negatives.

The plain C fixture omits APIs containing arbitrary integers. Its two source
paths each pass 1,815 assertions over 518 calls, including constructor switching,
owned strings, nested records, both buffer constructors and malformed-tag
recovery. This verifies the archive path without a GMP dependency.

Each test installs the original archive offline after removing the producer.
It compiles the consumer against packaged public headers and libraries, then
removes the handoff, consumer source and compiler-tool directory. The relocated
installation executes twice without compiler or runtime overrides. All loaded
libraries match the receipt: four for plain C, six for C/GMP. The consumer and
installed files remain unchanged. The GMP dependency's pinned source archive,
headers, library and build-check receipt are verified separately.

A separate rebuild reproduced all four package archives byte for byte. Every
installed package file also matched its recorded hash.

## Failure and ownership probes

Every package runs the shared native probe against the original Lean component:
1,182 assertions, 242 bridge-allocation failures, seventy invalid inputs and one
synthetic invalid returned tag. The tag injection preserves the typed reader's
reference-count handling. Inactive poison payloads are not read.

Each GMP build also runs a private copy of its facade with intercepted facade
allocations. Its 1,584 assertions cover 448 allocation failures, four malformed
inputs and valid recovery. Failed conversions preserve existing output values;
successful calls release the previous owned payload exactly once. Thirty-two
owned-output replacements are checked. Tracked facade allocations return to
zero after cleanup. GMP's process-wide allocator is not replaced.

AddressSanitizer and UndefinedBehaviorSanitizer report no errors. For each
real-Lean probe, LeakSanitizer's full report matches the same executable's
startup-only baseline: 128 bytes in twelve GMP allocations. Reports normalize
only process IDs and addresses. This verifies no additional reported leaks;
it does not claim an empty runtime exit report. The standalone constructor
switching test has no Lean runtime and reports no leaks.

## Reproduce

Use the [C author toolchain](../publish/c.md#build-an-ordinary-lean-project),
including a C compiler with address and undefined-behavior sanitizers:

```sh
LEAN_BRIDGE_C_VARIANT_TEST=1 node --test tests/c-variants.test.mjs
node --test tests/c-variant-contract.test.mjs tests/c-variant-evidence.test.mjs
```

CI requires and retains `build/variants/c.json`. Local runs use the explicit
glibc 2.36 test override; the production and CI floor remains 2.38. Tests remove
their temporary author and consumer directories. No registry package was
published.

## Scope

This record advances C copied variant parameters, results and fields on both
source paths. [C++ variants](cpp-variants-20260921.md) have separate installed
acceptance. The remaining native host, PHP-Wasm and WIT projections, bounded
recursion, compound callable payloads and explicitly owned identity aggregates
remain open.
