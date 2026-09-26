# Explicit resource aggregate ownership

This work adds compiler metadata and a semantic model for resource handles inside
collections, records, variants and recursive values. Private typed Lean/C
carriers, a native ownership ledger and typed native value conversion now
execute against the shared Lean runtime. Public host projections and installed
consumer packages remain unfinished. No installed coverage cells are promoted
by these checks.

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
C package. Reviewed version-4 source reconciliation and Wasm execution remain
unfinished.

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
callbacks or admit reviewed version-4 source contracts. Public session creation
also needs a fresh-context fork check before touching inherited broker locks.

## Remaining VO 1219 work

Connect the checked carriers and ledger to ownership-aware host projections.
Implement public handle validation, authorized transfer commit points and
host-callback failure recovery. Connect the native transaction limits to each
public projection and implement the Wasm transport. Then verify both ordinary
and reviewed source paths
through source-free installed consumer packages across all required profiles,
including callback and captured-closure positions. Malformed values and injected
allocation failures must release acquired resources before installed coverage is
promoted.
