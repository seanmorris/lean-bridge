# Owner-anchored borrowed results: native and installed C

Task: VO 1219. C packages implement parameter-anchored function results, preserving
the authored contract through fresh Lean analysis, compiled adapters and installed
archives. Other consumer projections remain unfinished.

## Lifetime rules

A borrowed result depends on one specific input owner, not merely the identity
of a resource. An independently retained alias cannot revive an expired view.

- Each registered result batch has a non-repeating generation. Reusing batch or
  context storage cannot make a stale view valid again.
- A borrowed batch links to its input owner's batch. The runtime bounds these
  chains at 128 levels, including results with no resource leaves.
- Releasing or transferring an owner expires all borrowed descendants. An
  iterative traversal uses existing links and cannot allocate or run out of
  recursive stack space. Transfer moves their resource leases into the call's
  input scope, so disposal cannot reenter during a partially completed handoff.
  Preflight checks the retained-entry limit for the entire tree before mutation.
- Expired batches remain registered until the host releases their result
  storage. Their copied payload storage can therefore survive long enough for
  the adapter to reject a later call safely.
- Input conversion checks the exact batch and generation before looking up its
  resource. Active calls pin their converted inputs through callback reentry.
- Explicit retain creates an independent owner. A borrowed owner cannot itself
  be consumed as a transferred input.
- If a callback closes the anchor, the enclosing call cannot publish a new
  borrowed result against it. Failed output conversion and commit retain the
  existing transaction cleanup rules.
- Reentry during disposal also rejects a sibling that still awaits cleanup:
  its ancestor must remain registered, not merely its own batch.

The default lease and transfer runtime headers remain byte-identical to commit
`2fab6b1635341d6622fc13fe8da9b3fdc947790e`. The extended native runtime requires an
explicit internal `anchoredResults` capability.

## Compiler and review

An owned export can declare a borrowed result with a parameter anchor such as
`{"ownership":"borrow","lifetime":{"scope":"parameter","anchor":"arg0"}}`.
Lean and the metadata reader reject missing, copied, or transferred anchors.
The semantic model preserves the authored result decision.

Independent reviews can name their parameters differently. Review selection
maps names to canonical input slots; reconciliation checks those slots before
restoring the reviewed names. Changing the anchor to another valid input fails
reconciliation. A contract cannot supply a type or authorize type erasure.

## Executed checks

Run `npm run test:owned-borrows` and `npm run test:owned-borrow-packages` with the
repository Lean toolchain and native package prerequisites available.

- The native probe executes 9,279 checks against compiled Lean and the shared
  identity broker, ending with zero tracked allocations and resource identities.
- The existing input-transfer probe executes 16,554 checks against the extended
  runtime.
- ASan and UBSan report no new findings relative to the cold-start leak baseline.
- Seven deliberately broken generation, expiration, membership, transfer,
  premature-destruction, disposal-reentry, and call-pin implementations fail
  the independent probe.
- Ordinary source and independently reviewed contracts preserve 18 anchored
  result declarations in the 22-export fixture. They cover resource leaves,
  collections, records, options, results, products, variants, aliases, recursive
  values, callback calls, and returned closures.
- Five invalid contracts fail real Lean extraction as well as the metadata
  reader. Backends without explicit result-anchor support reject these APIs.
- The public C probe executes 3,203 checks per source path, ending with no
  tracked allocations or identities. It rejects six broken implementations:
  unbound results, canonical-handle escape, missing owner membership, omitted
  view-identity cleanup, escaped callback views and missing ancestor checks.
- The mixed fixture has 24 exports, including 19 anchored results and two
  consuming functions. The 22-export fixture also compiles without either the
  transfer or host-callback capability.
- Ordinary and reviewed archives each pass 1,195 installed checks through
  pkg-config and relocated CMake. The test removes producer source and output
  before installation, then removes the handoff before relocated execution.
  The documented caller runs against the installed archive and prints `42`.
- Deterministic package reassembly reproduces the archive. Readers without the
  required capabilities reject it; seven forged result-anchor contracts reject.

Reports are written to `build/owned-borrows/`. The source-bound receipt is
`owned-borrow-results-20260930.json`. It preserves the previous WIT/WASI receipt
and records exact source transitions. No support-matrix cells are promoted.

## Public C contract

The generated function accepts the anchor's result-owner handle beside its input.
Its returned owner has an authenticated generation and parent chain. Owner-specific
opaque view handles cannot remain usable just because another lease retains the
canonical resource. Generated typed equality compares resource identity.

`result_validate` checks complete views, including empty containers. Raw C field
reads cannot check their lifetime automatically. Copied storage remains allocated
until result release; callers validate a borrowed result before reading it and
release expired result owners as well. Explicit retain and copy create independent
ownership while the source view is valid.

Component model version 9 records `resultAnchors`; C manifests use version 5 and
`ownedValues` version 4. Existing packages without anchors retain their versions
and generated files. Required C-family CI executes both enabled gates and uploads
their reports and logs.

## Remaining integration

Project those lifetimes into the remaining consumers' public values, including
explicit retain, disposal, callback reentry, error cleanup, and transfer
interactions. Verify ordinary and reviewed installed packages, relocation,
generated-source authentication, documentation examples, and required CI gates
before admitting each public backend. Receiver anchors and parameter-anchored
callback-result contracts are not implemented by this milestone. Docker installed acceptance and the final
cross-language documentation/support audit remain part of VO 1219.
