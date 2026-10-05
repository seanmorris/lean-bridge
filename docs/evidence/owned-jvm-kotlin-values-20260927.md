# Owned Kotlin value declarations

The Kotlin projection has its own records, sealed variants, options, results,
products and synchronous callback interfaces. Java and Kotlin values use the
same private layouts, conversion engine and ownership leases. Public identity
class names derive from nominal type names, not positions in the type catalog.
Adding unrelated types therefore does not rename an existing resource wrapper.

Opaque Kotlin resources and closures have private constructors. A Java base
keeps their handle field and constructor package-private. Kotlin aliases expose
the declared Lean names; consumers cannot read handles or construct identities.
Resource leaves retain wrapper identity in aggregate equality and hashing.

Validation on 2026-09-27:

- `LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-jvm-kotlin.test.mjs`
  passed three tests with no skips or failures.
- The composed-value consumer passed 22 checks. Twelve invalid consumers failed
  with the expected compiler diagnostic in each source file.
- The all-nineteen-scalar consumer passed 17 checks. Five invalid consumers failed
  with their expected diagnostics.
- Both consumers compiled and ran after deleting the generated library sources.
  They used compiled classes and Kotlin metadata, not producer source fallback.
- A generation check compares the resource alias across differently ordered
  catalogs and requires identical public class names.

The tests cover nominal Java/Kotlin separation, null rejection, immutable fields,
callback direction and return types, opaque construction, inaccessible handles,
deep equality, cycles, nested options, Unit, recursive values and scalar types.
The compiler is the pinned Kotlin 2.2.0 toolchain with JDK 22 and strict warnings.

These are value and metadata tests. They do not execute Lean, load native code,
or install a Maven package. Typed calls, host callbacks, authenticated loading
and installed Maven consumers remain separate required integration work.
