# Native and C input transfers

This stage implements explicit input transfer in the native ownership ledger
and public C projection. Ordinary configuration and independently reviewed
schema-4 APIs preserve the same transfer decisions through fresh Lean analysis.
Production package builds still reject transferred inputs. No installed-support
row changes in this stage.

## Executed checks

```sh
source scripts/env.sh
npm run test:owned-transfers
```

The native probe checks atomic moves of whole owner batches, exact resource
membership, duplicate and foreign owners, thread/process affinity, scope order,
session closure and the combined 4,096-reference limit. Commit does not allocate
or release references. The moved entries remain alive until the call completes
or aborts.

Independent C consumers execute 18 transferred declarations on both ordinary
and reviewed compiler paths. They check resources, records, variants, arrays,
Lists, Options, Except, tuples, aliases, recursion and Lean closures. The public
adapter nulls input-owner slots and removes their registry entries before Lean
or a host callback can observe the handoff. Copied source storage survives
callback reentry until the enclosing call returns.

Each C consumer passes 2,933 checks, including six allocation failures before
handoff and 20 after it. Failures before handoff preserve all input owners;
later failures keep them consumed. Independent retains remain usable. A transfer
of one member consumes its entire owner, including unused resource leaves.
Malformed replies retire the runtime without publishing outputs or restoring
input owners. Both C consumers finish with zero tracked allocations and runtime
identities.

AddressSanitizer and UndefinedBehaviorSanitizer runs match independent Lean
startup leak baselines. Mutation probes remove membership validation, duplicate
rejection, retention, moved-state updates, limits or source-payload cleanup;
the independent consumers must fail. A separate comparison requires identical
generated files for existing APIs when the transfer capability is enabled but
unused.

The [machine-readable record](owned-transfer-c-20260929.json) binds source hashes,
compiler inputs, execution reports and reversible transitions from the previous
WIT build repair. Earlier installed receipts remain unchanged.

## Remaining work

Enable and verify prepared C packages, then implement the corresponding move
semantics in the other consumer bindings. Owner-anchored borrowed results and
owned Docker acceptance remain open. Callback arguments passed from Lean to a
host callback still borrow the invocation; this stage does not transfer those
callback-local arguments.

The downstream PHP job on `4103db9` exceeded its five-hour budget in the final
mixed-profile Nix build. Its earlier native/PHP-Wasm steps completed, but the
job and support summary did not pass. The workflow now allows six hours and
retains every test and enforcement step. A remote rerun must verify that budget.
