# Python ownership runtime foundation

VO1219 remains open. These probes compile Lean and exercise Python resource
leases. They do not establish generated aggregate conversion or installed wheel
support, and they promote no type-surface cells.

`ownedPythonRuntime` generates nominal opaque resource wrappers, shared shallow
copies, call-scoped borrowed leases and guarded native results. Resources check
the creating Thread object and process before use. Foreign-thread finalization
queues cleanup for the creating thread. Thread-local teardown releases native
results even if a resource wrapper escapes its thread. Forked children reject
use before entering inherited Python locks or native functions.

Results remain guarded until the entire Python conversion succeeds. A failure
revokes partial wrappers and releases the native result immediately, even when
the application retains the exception and its traceback. A regression first
failed because adoption transferred ownership before wrapper construction. The
guard now publishes ownership only when its context exits without an exception.

Validation on ordinary source and independently reviewed IR:

- Python 3.11.16: 324 assertions per source path.
- Python 3.12.14: 325 assertions per source path.
- Each run sweeps five injected Python allocation failures and four native
  allocation failures, preserving exceptions across the cleanup assertions.
- Borrow expiry, explicit retention, partial-result rollback, shallow copies,
  copy/serialization rejection, foreign-thread collection, thread-exit cleanup
  and fork rejection pass. Both versions finish with zero live bridge
  allocations and zero native resource identities.
- Python 3.12's warning about forking a multithreaded process is captured and
  checked explicitly. Other unexpected stderr still fails the probe.

Command: `LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-python-runtime.test.mjs`.
The accepted run passed 3/3 tests, with no skips, in 99,893 ms. Reports live in
`build/owned-python-runtime/{ordinary,reviewed}.json`; the local log is
`build-owned-python-runtime-transaction.log`. Selected ESLint also passed.

The test-only C shim converts small Nat serial numbers. Public exact integer
conversion is not implemented by this foundation. Generated Python values,
bounded conversions, typed callbacks and returned closures, authenticated
prepared wheels, source-free installed acceptance, catalog registration and
consumer documentation remain next steps. Transfer and anchored lifetimes,
other host projections and Wasm ownership remain part of the full task.

The [values and callbacks follow-up](owned-python-values-20260927.md) records
the subsequent all-primitive conversions, typed functions and compiled callback
acceptance. Prepared wheel delivery remains separate from these foundation probes.
