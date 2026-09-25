# WIT/WASI structured callbacks

VO 1219. Native-backed WIT packages accept arrays, Lists, options, results,
products, acyclic records, variants and copied aliases in synchronous callbacks
and captured Lean closures. Callers use public Component Model values and
generated resource functions. No JSON or Lean constructor numbers cross the API.

## Installed packages

Ordinary Lean source and an independent Binding IR review each build a
26-export package. Tests relocate the original archive and delete the author
workspace before installation. Each consumer passes 470,573 checks, including
3,911 counted calls, 3,493 callbacks, 52 expected rejections and 401 finalizers.
Both consumers repeat after the package handoff is removed. The installed file
inventory and six loaded packaged libraries retain their verified identities.

Values include embedded NUL, Unicode, exact Nat/Int, empty containers, Unit,
None versus Some(None), active error branches and copied variants. Returned
values outlive their inputs and closure owners. Invalid replies, excessive
nesting, the 16 MiB conversion limit, expired borrows, closed resources, wrong
threads and foreign sessions reject. Valid calls recover after failures.

A separate installed regression places nested aliases only inside callbacks
and mixes aliased and unaliased public signatures. Each source path passes
56,065 checks, with 576 callbacks, 192 finalizers and 192 rejected replies.
Public aliases keep their WIT names while the native adapter shares compatible
trampolines without function-pointer casts.

The publisher's Lean example and the consumer's C file compile from the guides.
Both source paths install the resulting archive, remove the author sources and
handoff, and execute the documented example twice without Lean or compilers.

## Reply ownership and regressions

Inline records and active branches share an owner for converted callback
storage. Each outermost buffer retains one reference. Arrays retain the entire
arena; their nested views stay borrowed. Scalar-only and empty branches release
temporary storage immediately. Values remain on their session's creating thread.

A synthetic adapter probe tests cleanup separately from installed Lean
execution. Normal and ASan/UBSan runs each pass 70,148 checks, including 176
injected allocation failures, with zero tracked allocations left live. Removing
a buffer reference produces a detected use-after-free. Retaining the temporary
construction reference violates the allocation baseline.

The predecessor comparison retains sixty identical generated WIT/C files and
twenty-one identical shared native-C adapters. Two previously broken alias
adapter cases now generate successfully. A fresh installed primitive regression
checks all nineteen types and 63 exports on both source paths.

The [execution record](wit-structured-callables-20260925.json),
[code-generation comparison](wit-structured-codegen-regression-20260925.json)
and [source transition](wit-structured-callable-integration-20260925.json)
promote exactly thirty-two callback cells, bringing the inventory to 4,782 of
6,562 installed-tested cells. All seventeen profiles now have installed coverage
for acyclic copied callback payloads.

Use the [contributor commands](../contributing/testing.md#structured-wit-callbacks)
to rerun the installed, alias, documentation and fault checks. CI requires all
four reports and uploads them separately from older WIT evidence.

Recursive callback payloads, resource-containing aggregates, retained host
callbacks and asynchronous delivery remain separate work. Schema nesting is
limited to 32. Each conversion phase has a 16 MiB budget; these limits do not
bound all Wasmtime or Lean working memory.
