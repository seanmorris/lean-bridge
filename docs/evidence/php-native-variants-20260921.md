# Installed native PHP tagged variants, 21 September 2026

Prepared Composer archives expose each copied Lean variant as an abstract
readonly family and a final readonly class for each constructor. Named or
positional arguments carry the original payload fields. Consumers use no
native tags, FFI declarations or Lean memory layouts.

The [machine record](php-native-variants-20260921.json) binds the original ZIPs,
installed files, independent public consumers and isolated probes to their
hashes. Acceptance covers PHP 8.2.33 NTS CLI on Linux x86-64. Local tests use the
existing glibc 2.36 override; production keeps the glibc 2.38 floor.

## Installed checks

Both ordinary-source and independently reviewed builds export fourteen
functions across seven families and eighteen constructors. Each weak or strict
caller passes 37,686 assertions over 4,460 calls, including fifty-four rejected
inputs followed by recovery. The two lexical modes receive identical checks.

The handwritten consumer covers all nineteen primitive payload types, nested
variants, records, arrays, Lists, options, results and products. Cases include
5,121-bit integers, machine-word limits, Unicode and embedded NULs, binary data,
floating-point special values and signed zero. Eighteen changed-field negatives
check scalar meaning against a separate Lean inspector. Reflection checks
family relationships, final readonly cases, original field names and public
function signatures. Empty cases remain distinct from cases containing Unit.

PHP reserves `echo`. An explicit `Variants.echo_signal` Lean wrapper delegates
to the unchanged shared fixture. Both source paths select that real declaration;
the review does not rename an export without a matching source definition.

Consumers install the original ZIP offline with Composer after the author
project is removed. They use an empty home/cache, disabled plugins and scripts,
the pinned Brick Math dependency and a locked second installation. Each
installation relocates, removes the archive handoff, then executes twice
without compilers, PHP configuration files or runtime overrides. All sixty-seven
deployment files remain unchanged, including twenty-five package-owned files
and four loaded native libraries. Each library matches its receipt.

An independent rebuild reproduces both original archives and all twenty-five
package-owned files byte-for-byte. The public observations retain each fresh
installation's absolute API path, so complete reports are not byte-identical.
Composer-generated deployment metadata is not claimed identical across builds.

## Failure and ownership checks

A separate PHP process instruments an in-memory copy of the private FFI adapter.
It does not modify installed files. Each source path passes 7,123 probe checks:

- 460 injected exceptions across twenty-three calls, covering all eighteen
  constructors, nested copied payloads and native results.
- Sixty-four partial-input failures that never enter native code.
- Two real native copy-budget failures.
- Seven malformed tags rejected before a payload branch is selected.
- Six cases that ignore poisoned inactive union storage.
- Five malformed string or array payloads rejected before unsafe reads.

The original injected Throwable survives cleanup. Every instrumented call
clears its native output and closes its scope once. Weak references verify
that scratch owners and scopes are released; public calls recover afterward.
Branch instrumentation records 188 valid selected branches. Synthetic poisoned
values reach only private decoders, never native calls or clear functions.
Both unmodified public callers run again in fresh processes after the probe.

The shared real-Lean native probe passes 1,182 checks, including 242 allocation
failures, seventy malformed inputs and one injected returned tag. Address and
undefined-behavior checks pass. LeakSanitizer retains the startup-only GMP
baseline of 128 bytes in twelve allocations, with no additional conversion
leaks. These checks do not measure all PHP allocations or Lean working memory.

## Value semantics

Calls require exact generated cases with initialized payload fields. Unknown
family subclasses, tagged arrays, weak numeric coercion and uninitialized
reflection-created objects reject. Public names remain separate from private
C names, including fields named `bool` and `signedWord`.

Results own independent copied values. Readonly properties cannot be reassigned;
contained values keep their PHP array/object semantics. `===` compares identity,
while `==` follows PHP comparison rules. PHP does not check match exhaustiveness.
The existing 32-level schema limit and separate 16 MiB validation, PHP conversion
and native-copy budgets remain in effect.

Only concrete, non-recursive copied variants are admitted. Generic, indexed,
proof-bearing, callable and identity-bearing payloads remain separate work.
PHP-Wasm variants are not enabled by this milestone.

## Reproduce

```sh
source scripts/env.sh
LEAN_BRIDGE_PHP_VARIANT_TEST=1 node --test tests/php-variants.test.mjs
node --test tests/php-variant-contract.test.mjs tests/php-variant-evidence.test.mjs
```

Set `LEAN_BRIDGE_PHP` and `LEAN_BRIDGE_COMPOSER` to absolute tool paths if needed.
The installed test writes `build/variants/php-native.json`; CI requires and
uploads it. Inventory 0.64.0 promotes exactly six copied-variant cells across
both source paths, bringing installed variant coverage to fifteen of seventeen
profiles. PHP-Wasm and WIT variants follow. Bounded recursion, compound callable
payloads, explicit identity-aggregate ownership and the older reviewed
array/record audit remain part of the full structured-type goal.
