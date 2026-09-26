# Resource-containing host callbacks

The C projection accepts synchronous host callbacks whose arguments
and results contain explicitly leased resources. Fresh ordinary Lean exports and
an independently authored version-4 review execute the same public C consumer.
Prepared C packages include the callback adapter and shared runtime. Installed
ordinary and reviewed consumers run without the producer source or Lean compiler.

## Lifetime and failure handling

A generated callback descriptor selects a C function and context, or an existing
Lean closure. The descriptor and host context borrow the enclosing call's
lifetime. A Lean closure that captures that callback cannot invoke the host after
the borrow expires. The shared callback registry rejects its expired token.

Callback arguments are temporary immutable views. A reply may borrow an argument
or context storage. For callback-local storage, generated copy functions produce
an owning result. The callback transfers that result to the bridge, which releases
it on both success and failure. Resource pins in the enclosing native transaction
preserve identity after the callback's temporary owners have been released.

Lean must receive a valid typed value even when the host fails so compiled code
can finish reference-counted cleanup. Recovery uses actual arguments, unconditional
record/product projections, and finite constructors. It never invents an opaque
resource. If no such recovery exists, the descriptor requires a checked recovery
value before the call begins. Each descriptor's `REQUIRES_RECOVERY` macro states
that requirement. Recovery values never become successful outputs of failed calls.

The first callback failure suppresses later host invocations in that call. The
bridge leaves public output slots unchanged and releases partial conversions and
leases. A later independent call can succeed. Callback conversions consume the
enclosing call's limits; repeated invocations cannot reset their budget.

## Execution checks

Run the real compiler and C probes with:

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-host-callbacks.test.mjs
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-host-packaging.test.mjs
```

The consumer checks nested records, recursive variants, distinct resource
identities, returned Lean closures, expired host borrows, typed resource-factory
recovery, reentry, and owning copies of callback-local values. It creates new
resources inside callbacks and releases an input owner while the call is active.
It also checks session closure during a callback, repeated-call limits, and
failure at every bridge allocation in four callback modes.

Ordinary and reviewed executions each pass 4,635 checks and 642 allocation-failure
injections, with zero remaining bridge allocations and broker identities.
AddressSanitizer and UndefinedBehaviorSanitizer runs match the unsuppressed
cold-start control: Lean/GMP reports 128 bytes in 12 allocations. The test harness
compiles Lean objects with the production `-fPIC` setting and rejects an executable
COPY relocation for the imported `ByteArray.empty` global.

Generated adapters, public headers, compiler identities, consumer hashes and
sanitizer observations are recorded under `build/owned-host-callbacks/` for both
source paths.

The installed consumer passes 693 checks per source path with pkg-config, then
again after relocating the installed package and rebuilding through CMake.
It exercises callback-local owning copies, new resources, typed factory recovery,
recursive values, existing Lean closures, expired host borrows, failure suppression,
budget exhaustion, input-owner release and session closure during a callback.
The producer source and output are deleted before installation; the archive
handoff is deleted before relocated execution. Lean and the producer runtime are
unavailable in the consumer environment. These installed runs do not inject faults;
the separately compiled probes above provide that control.

Package checks also require byte-identical archive reassembly and reject forged
callback lifetimes, adapter capabilities and retained trampoline source, including
forgeries with updated file hashes. Native model version 7 and version-3 component,
adapter and package receipts authenticate the enabled capability. The compiler
staging cleanup retains `callbacks.c` alongside `component.h` and `generated.lean`.
The earlier 22-export owned-value fixture still passes 500 installed checks per
source path through both pkg-config and relocated CMake.

Reports live under `build/owned-host-packaging/` and `build/owned-c-packaging/`.
The [execution record](owned-host-execution-20260926.json) binds their original
logs, compiler inputs, generated source identities and package receipts. The
[source history](owned-host-integration-20260926.json) preserves earlier evidence
without rewriting it. It also includes the Nix Perl source-list repair and a
fresh-process filtered-source import check. That check is not a Nix build.

## Remaining work

Other language projections, Wasm, transfer inputs, anchored results, retained host
callbacks and the full ownership matrix remain open. No installed type-surface
cells are promoted by this C-only milestone.
