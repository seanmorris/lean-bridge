# Explicit resource aggregate ownership

This work adds compiler metadata and a semantic model for resource handles inside
collections, records, variants and recursive values. Private typed Lean/C
carriers, a native ownership ledger and typed native value conversion now
execute against the shared Lean runtime. An independently compiled public C
consumer executes both ordinary and reviewed-v4 projections. Other host
projections and installed consumer packages remain unfinished. No installed
coverage cells are promoted by these checks.

## Author decision and compiler evidence

The shared configuration accepts an explicit development-stage ownership policy:

```json
{
  "ownedAggregates": {
    "ownership": "lease",
    "disposal": "required",
    "fallback": "queued-finalizer",
    "cycles": "reject"
  }
}
```

`fallback` also accepts `none`. The compiler request includes this decision in its
invocation identity. The author still selects each resource through `resources`.
The policy supplies no Lean types, object layouts or proof claims. Existing
package builders reject the policy until their ownership-aware transport is
connected. The internal source scanner cannot authorize it.

Lean emits a distinct `owned-graph` wrapper containing a finite nominal table,
the policy and checked native representations. Resource leaves keep their names
and source modules. Removing the policy restores the existing rejection of
identity-bearing values in copied positions. Retaining host callbacks inside
aggregate fields remains rejected; this policy authorizes resource fields only.

The JavaScript validator checks the policy against the retained request, every
resource against the configured module closure, reference/definition boxing
agreement, complete reachable tables and alias termination. It rejects unknown
fields, accessors, sparse tables, duplicate definitions, hidden callbacks,
unreachable types, resource/value identity collisions and policy drift. Bounds
remain 32 inline edges, 1,024 nominal definitions and 4,096 descriptor nodes.

## Ownership-aware Binding IR

The separate version-4 contract adds `owned` representation, an explicit
`aggregatePolicy` for anonymous containers, and an `aggregate` policy on owned
records and variants. Copied siblings remain copied. Resource leaves retain
identity representation. Aliases preserve their target representation; recursion
uses nominal references instead of expanded trees.

Parameters borrow for the duration of a call. Returned aggregates acquire an
explicit lease. The contract can represent an anchored borrowed result, but the
current compiler lowering rejects export contracts that request an unimplemented
ownership transition. Borrowed results cannot use a call-only lifetime, a copied
anchor or a transferred owner. Aggregate structure and fields are immutable.

`createOwnedElaboratedSemanticModel` retains the complete compiler-derived
contract, source identity and theorem references. `compileOwnedAggregateModel`
preserves field order, Option/Except branches, aliases, callback signatures and
per-field copy/lease decisions. Its anonymous containers use the IR's authored
policy, including `fallback: "none"`. The original version-3 validators,
canonicalizer and backend entry points do not admit the new contract.

## Executed checks

The ordinary Lean fixture has 22 selected exports and three value-preservation
lemmas. Fresh Lean 4.32.2 extraction is compared with an independently specified
contract for arrays, Lists, Options, results, products, records, variants,
aliases, recursive trees, nested containers, callback parameters and captured
closures. Both the source fixture and its lemmas compile. These checks do not
execute a resource-bearing bridge call; the separate native gate below does.

Run the compiler gate from the repository root:

```sh
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 node --test \
  tests/owned-aggregate-metadata.test.mjs
```

The gate also removes the policy, alters retained decisions, removes configured
resource identities, attempts to retain a callback field and asks for copied
result ownership. Each invalid case must reject. Fast contract/model tests cover
anchored borrows, missing policies, alias cycles, recursive references and finite
type budgets. No runtime leak or installed-package claim follows from these
metadata tests.

## Compiled native carriers and ownership

`generateOwnedAggregateCarriers` checks the retained compiler metadata and emits
typed one-element Array helpers for constructors, projections, branches, exported
calls and returned Lean closure invocation. Resource leaves retain their original
Lean objects. The generated C prototypes are checked against actual Lean C
output. C never reads resource record offsets. Empty or oversized helper carriers
reject without inventing a resource value.

The private native ledger holds one Lean reference and one shared-runtime
identity reference per unique object and nominal kind in a context. Repeated
fields share that identity. Independent contexts may retain the same object.
Call inputs acquire pins, so closing a parent result during a call cannot destroy
its borrowed children. Successful calls commit acquired outputs to an explicitly
released batch; failed conversions abort all acquisitions. Closing a context
defers cleanup until its active scopes finish.

The ledger rejects stale tokens, wrong nominal kinds, foreign contexts,
unregistered batches, double releases, out-of-order scopes, wrong processes,
wrong threads and reused thread identifiers. It limits each scope to 4,096
retentions and each context to 64 nested scopes. Exhausted broker identities and
failed ledger allocations leave output tokens untouched. Cleanup remains valid
after runtime retirement.

Run the native gate:

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test \
  tests/owned-aggregate-native.test.mjs
```

It executes all 22 fixture exports, recursive values through depth 128, retained
children after their parent closes, and captures after the original aggregate
and resource owners are released. It injects failure at every one of 96 ledger
allocations in a mixed acquisition/borrow transaction. The normal and sanitized
runs return with zero live ledger allocations and zero broker identities. The
unsuppressed leak report must match a separate startup-only run. Lean/GMP startup
retains 128 bytes in 12 allocations on the local pinned runtime; the exercised
run adds none. Mutations that omit retention, release, rollback or thread
generation checks must fail the independent caller.

The callback-valued parameter checks use actual Lean closures. They do not yet
construct host callbacks or implement host-exception recovery for resource-valued
callbacks. The carrier and ledger are internal native components, not an installed
C package. The reviewed version-4 C gate below checks source reconciliation;
Wasm execution remains unfinished.

## Native value transactions

The private native layout stores copied primitive payloads beside opaque resource
tokens. Nested non-leaf fields use pointers, so recursive types have finite C
layouts. Aliases retain their identity in the checked contract and resolve without
adding artificial value depth. These layouts are adapter internals. Public host
APIs must supply named fields and variants without exposing tokens or tag numbers.

`generateOwnedNativeValueAdapters` emits input validation, typed Lean calls and
output conversion in one transaction. Each transaction counts input and output
visits, nesting, native payload bytes and acquired resource references. Limits
are depth 128, 262,144 visits, 16 MiB of native value storage and 4,096 retentions.
The byte limit covers transferred payloads and output arena allocation headers,
not all memory used by the Lean algorithm. List and Array projections receive
the remaining element budget before creating temporary child carriers.

Failed calls leave the caller's result untouched. They release temporary Lean
values, input pins, acquired output handles and native arena allocations.
Successful results keep copied fields alive until explicit disposal. Resource
children and returned closures can outlive the original aggregate owner. Cleanup
also drains native allocations when the identity broker reports an error after
releasing its references.

Run the value gates:

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test \
  tests/owned-native-values.test.mjs tests/owned-native-scalars.test.mjs
```

The value caller checks all 22 exports, every variant branch, nested containers,
recursive trees, retained children and actual Lean closure invocation. It checks
each lower byte/visit budget for a mixed record and the 2,048/2,049 repeated-handle
boundary for a call that borrows inputs and retains outputs. It injects all 92
allocation failures across record conversion, recursive conversion, fresh resource
creation, closure acquisition and closure invocation. Mutations that omit arena
cleanup, failed-commit cleanup, failed-release cleanup or cycle detection must fail.

A second authored Lean fixture checks all 19 primitive types inside a
resource-bearing record. Independent Lean constructors and predicates check
integer bounds, large Nat/Int values, UTF-8 with embedded NUL, binary bytes,
floating-point values and copied fields beside retained identities. It preserves
`None`, `Some(None)` and `Some(Some(Unit))`, and tests empty records and Lists.
A List with 131,071 Unit elements passes the combined input/output visit budget;
131,072 elements reject. Ten additional allocation-failure cases leave no live
adapter allocations or broker identities.

Both callers run under address and undefined-behavior sanitizers. Leak reports
remain unsuppressed. The value caller matches the startup-only Lean/GMP report
of 128 bytes in 12 allocations. The scalar fixture's direct compiled Lean calls
report 240 bytes in 18 allocations, unchanged between one call and 100 repetitions;
the adapter exercises produce the identical report. Reports retain both controls
in `build/owned-aggregate-native/values.json` and `scalars.json`.

The bit-level checks distinguish transport from Lean operations: echo preserves
NaN payloads, while Lean 4.32.2's `Float32.toBits` and `Float.toBits` return
canonical NaN bit patterns. Signed zero and infinities remain distinct.

The private transport currently targets 64-bit native Lean. It accepts
call-scoped input borrows and explicit result leases. It does not construct host
callbacks. Its reviewed version-4 path reconciles the contract before generating
typed carriers. Public session creation
now checks the shared runtime's process before touching inherited broker locks.
The same lock-free guard protects initialization, readiness, retirement, identity
operations, snapshots, callbacks and shutdown. Tests fork while the broker mutex
is locked, reject fresh and inherited contexts in the child, and verify that the
parent remains usable. Deliberately removing either the readiness guard or the
callback lookup guard makes the corresponding deadlock test fail.

## Public C projection

`src/backends/c/owned-package.mjs` generates a C API over the authenticated native
transactions. Its header has source-named fields and constructor enums, typed
spans for Array/List, `has_value` for Option, `is_ok` for Except, and `fst`/`snd`
for tuples. Nat and Int use read-only `mpz_srcptr` views. Resource and closure
handles are opaque types, with no public token fields or Lean constructor tags.
Anonymous containers have aliases named for their fields and call sites; shared
alias graphs expand once instead of duplicating every path.

Each successful call returns a value view and an opaque result owner. The owner
retains native resource leases, copied storage and GMP integers. Releasing it
does not traverse caller-visible fields. A caller may copy a view, but that copy
does not extend its lifetime. Generated `retain` operations give resources and
returned Lean closures independent owners. Releasing a stale owner or using a
resource in a different session fails without dereferencing a caller-supplied
handle. Sessions and results use generation-checked registry identities.

Sessions belong to one thread and process. Closing a session invalidates its
resources and prevents further calls. Its copied result data remains readable
until the caller releases each result. Cleanup remains available after runtime
retirement. A malformed native reply retires the runtime and leaves the public
output slots unchanged. Input spans must refer to readable C storage, and GMP
inputs must be initialized values. GMP keeps its default fatal allocation policy.

The C view conversion has a cumulative input/output budget of 262,144 visits and
16 MiB of conversion storage. The underlying native transaction independently
enforces its 262,144-visit, 16-MiB storage and 4,096-retention limits. Both layers
reject value depth above 128 and cycles. These storage budgets do not cap Lean
algorithm allocations or all GMP allocator overhead. A List of 131,071 Unit
elements passes; 131,072 fails without publishing a result.

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-c-values.test.mjs
```

The consumer and generated implementation compile in separate translation units.
The consumer includes only the public header. It exercises named records, every
Choice constructor, aliases, nested containers, recursive trees, independently
retained children and captured Lean closures. A second consumer checks all 19
primitives against independent Lean constructors and predicates, all three nested
Option Unit cases, empty records, exact large integers, binary strings, floating
point payload bits and list limits. Tests inject failures at every allocation in
selected record, closure and scalar construction calls. They reject four compiled
cleanup/cycle mutants, and run address/undefined-behavior sanitizers with
unsuppressed leak reports. The scalar leak report is compared with direct Lean
calls after both one and 100 repetitions, not just a cold process.

Reports are `build/owned-aggregate-native/public-c.json` and
`public-c-scalars.json`. This is executable projection evidence, not installed
package evidence. The ordinary package builders still reject owned aggregates.
The C API can invoke returned Lean closures; host callback construction and its
failure recovery are not implemented by this layer.

## Independently reviewed owned contracts

`readReviewedOwnedSource` captures one version-4 `.binding-ir.json` before
compilation. The shared configuration supplies only the authorized source modules
and packaging settings. The review selects exports, named resource types,
returned-closure arities and aggregate ownership policy. The compiler invocation
includes the exact review identity, including both its raw and semantic digests.

`reconcileReviewedOwnedSource` compares the review with fresh Lean metadata.
Record fields and variant branches must match in order, name and type. Resource
kind, aggregate policy, aliases, effects, failure behavior and lifetimes must
also match. Parameter names and documentation may differ. The resulting contract
keeps author annotations, including constructor/field documentation and callback
parameter names, while retaining compiler-produced source positions, producers
and theorem references. Claimed proof or layout extensions in the review reject.

The existing v3 reader still rejects v4. Ordinary package builders do not yet
select the ownership-aware path. The internal reviewed C gate runs with:

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/reviewed-owned-source.test.mjs
```

The gate uses the independently authored contract and real Lean extraction, then
compiles the same public C consumer in a separate translation unit. It checks
resource lifetimes, nested values, all variants, recursive trees, Lean closures,
allocation-failure cleanup and sanitizers. A changed review runs through the
extractor again and must reject reordered constructors against the new metadata.
The report is `build/owned-aggregate-native/reviewed-public-c.json`. These are
compiled projection checks, not source-free installed-package acceptance.

## Remaining VO 1219 work

Complete the ownership-aware host projections and their package-builder paths.
Implement authorized transfer commit points and host-callback failure recovery.
Connect the native transaction limits to each public projection and implement
the Wasm transport. Then verify both ordinary
and reviewed source paths
through source-free installed consumer packages across all required profiles,
including callback and captured-closure positions. Malformed values and injected
allocation failures must release acquired resources before installed coverage is
promoted.
