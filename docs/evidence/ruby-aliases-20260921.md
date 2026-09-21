# Installed Ruby copied aliases, 21 September 2026

Prepared gems retain 27 copied alias names, original targets and chains in their
manifest, README and public API comments. Ruby callers use ordinary target
values, including generated record classes. Aliases do not create separate Ruby
constants, wrapper classes or RBS declarations. Their parameter, result and
record-field sites retain the original Lean type names.

## Installed validation

Ordinary-source and independently reviewed builds compile the unchanged shared
native alias fixture plus a small explicit `inspect_scalars` wrapper. Ruby
reserves `inspect`; the wrapper keeps that protection and the earlier fixtures
intact. The test compares every alias target, record field and exported signature
with the independent reviewed contract before packaging.

Both source paths pass 4,509 public assertions. They cover all nineteen
primitive types, exact 5,121-bit integers, fixed-width and machine-word limits,
Float32 rounding, signed zero, subnormals, infinities, NaN classification,
Unicode and NUL. Lean independently inspects all nineteen fields of a copied
record. Changing each of its eighteen non-Unit fields makes that check fail.

Calls preserve alias chains, return-only aliases, record fields, nested
List/Array values, three nested Option Unit states and both Result branches.
Mutation checks verify independent input, result and sibling storage. Nat
rejects negative integers while Int accepts them. Unit remains the `UNIT`
singleton. Invalid types, coercion objects, subclasses, ranges, encodings,
product arities and cyclic inputs reject. Oversized copies fail, and later calls
succeed. GC compaction and four concurrent callers preserve values.

The suite installs each exact archive offline after removing its producer
project and build directory. It relocates the gem installation, removes the
archive handoff, then runs the public consumer twice with no compiler on PATH
or runtime-path override. Both paths load identical native library bytes.
Installed-file and receipt hashes remain unchanged. The installed Ruby API
sources stay in the gem, as required for interpreted execution.

## Cleanup and malformed values

A separate process instruments 56 conversion methods in memory. It never edits
the installed gem. Each source path passes 317 injected conversion/allocation
failures, verifying freed scratch, empty scopes, one native output clear per
call and recovery. Another 64 partial-input failures reject before reaching
Lean. Twenty-two malformed-native checks cover branch flags, ignored inactive
payloads, sequence lengths, buffer presence/alignment, nested Lists, UTF-8 and
Unicode scalars.

Native copies and Ruby input scratch retain their existing 16 MiB accounting
budgets. Copied type nesting remains bounded to 32 levels. These budgets do
not measure all Ruby allocations or Lean working memory.

## Reproduce

```sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_RUBY_ALIAS_TEST=1 node --test tests/ruby-aliases.test.mjs
node --test tests/ruby-alias-contract.test.mjs
```

Local acceptance uses MRI Ruby 3.3.12 on Linux x86-64 and the existing glibc 2.36
test override. Production and CI retain the glibc 2.38 floor. The report is
`build/aliases/ruby.json`; the [source-bound receipt](ruby-aliases-20260921.json)
records interpreter, fixture, contract, installed-file and archive hashes.
CI requires and uploads the report.

Repeated builds reproduce both gem archives byte-for-byte. Alias-free callback
and List packages keep identical generated files. Existing installed callback,
compound and List suites pass on both source paths. Package auditing accepts
alias names such as `Pointer` in generated comments while continuing to reject
public native-binding declarations.

Inventory 0.51.0 promotes only six Ruby alias cells: parameters, results and
record fields on both source paths. Perl, native PHP, PHP-Wasm and WIT/WASI
aliases remain open. Native variants, bounded recursion, compound callable
payloads and explicitly owned identity-bearing aggregates remain part of
VO1219 and VO1221.
