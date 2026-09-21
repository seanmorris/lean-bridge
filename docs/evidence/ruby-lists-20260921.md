# Compiled Ruby Lists

VO1219 adds copied `List T` inputs, results and record fields to prepared gems.
Ordinary-source and independently reviewed-IR builds compile the same 27-export
Lean fixture. Ruby uses exact `Array` instances. Lists retain distinct Binding
IR and native C identities while preserving empty values, order, duplicates and
nesting. Returned arrays and mutable payloads own independent storage.

## Installed validation

```sh
LEAN_BRIDGE_RUBY_LIST_TEST=1 node --test tests/ruby-lists.test.mjs
node --test tests/ruby-list-contract.test.mjs
```

The [machine-readable record](ruby-lists-20260921.json) binds archive, receipt,
source, interpreter and installed-file hashes. Each source path passes 88,446
public assertions with MRI Ruby 3.3.12. The suite installs the gem offline after
removing producer sources, relocates the installation, deletes the archive
handoff, and executes the consumer twice without compilers. It verifies the
loaded native libraries against the receipt and checks that installed files
remain unchanged. Ruby sources remain part of the installed gem.

The consumer checks all nineteen primitive elements, exact 5,121-bit integers,
fixed-width limits, Float32 rounding, signed zero, subnormals, infinities, NaN
classification, Unicode and embedded NUL. It checks mixed Lists and arrays,
record fields, option presence, both result branches and binary products.
A 24-level fixture exercises every empty level. Mutation checks verify that
input and sibling-result storage remain independent. Frozen input arrays are
accepted. Results survive GC compaction, and four threads retain independent
call state. A 30,000-element generated List exercises native traversal.

Invalid containers, subclasses, coercion objects, element types, ranges,
encodings, product arities and cyclic values reject. Nil is accepted only at
Option positions. Oversized inputs and outputs raise, and later calls succeed.
The public consumer uses no native declarations or private adapter methods.

## Cleanup and malformed output

A separate process instruments installed methods in memory without changing
package files. Per path, 384 injected conversion and allocation failures verify
freed scratch pointers, empty scopes, one native output clear per call and
successful recovery. Sixteen partial-input failures check cleanup before Lean
runs. The probe instruments 156 conversion methods.

Nine malformed-output checks reject excessive lengths, missing buffers,
misalignment and an invalid nested List buffer. Poisoned empty buffers are
ignored. Guards run before output allocation or element reads, using native
element alignment, including compound fields. Native allocator fault coverage
remains in the [C/C++ List suite](native-lists-20260920.md).

Ruby input scratch and native input/output copies each have a 16 MiB accounting
budget. Per-sequence output guards also limit each allocation. These checks do
not bound every Ruby allocation or Lean working memory. Types have a 32-level
nesting limit. Local acceptance uses Linux x86-64 with glibc floor 2.36; CI
builds supported 2.38-floor packages. Ractors remain unsupported.

This milestone promotes six profile/path/position cells: List inputs, results
and fields on both source paths. List callback payloads, aliases with distinct
runtime identity, arbitrary or recursive variants and resource-containing
copies remain separate work.
