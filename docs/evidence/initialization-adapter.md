# Generated Initialization Adapter Evidence

Status: every projected component carries one generated first-call initialization plan.

## State contract

`compileInitializationV1` binds the private initializer to the canonical Binding IR hash. The generated plan fixes these rules:

- the first native call triggers initialization;
- one component runtime runs its initializer once;
- a nonzero result marks the component ready;
- failure is terminal for that component runtime; and
- the loader never retries a failed initializer.

The plan stays inside the runtime projection. Generated npm entry points do not expose its symbol or state.

## Runtime behavior

The shared runtime registry records `initializing`, `ready`, or `failed` under the component build and initializer identity. Calls through different functions and classes use the same entry. Re-entry during initialization fails. A failed entry rejects every later call without invoking native code again.

The loader checks the plan's Binding IR hash before resolving the private symbol. Metadata drift therefore fails before initialization. Components without an initializer receive an explicit no-op plan rather than an absent policy.

## Executable checks

`tests/initialization-adapter.test.mjs` verifies required and no-op plan generation, one plan shared by every projected Alpha binding, deferred execution, exactly-once behavior across callables, terminal failure, no retry, diagnostics, and hash-drift rejection.

The cross-compiled Alpha suite separately verifies the real Lean startup and shutdown sequence, one runtime initialization domain, deferred first use, terminal `Init` failure, and no reinitialization after shutdown.
