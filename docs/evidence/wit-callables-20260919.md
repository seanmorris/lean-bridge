# Native WIT primitive callable acceptance, 2026-09-19

VO1218 adds installed WIT callbacks and returned Lean functions. The 63-export library builds from ordinary Lean source and from an independently authored, compiler-checked Binding IR review. Both packages execute real Lean through the generated Component Model binary and Wasmtime 42.0.1 host.

The [machine-readable record](wit-callables-20260919.json) contains archive, receipt, source-tree, model, Binding IR and consumer hashes. Each path makes 4,905 component call attempts, including nested calls and expected rejections. This is a call count, not an assertion count. The producer workspace is deleted before archive installation; the installed consumer compiles against the archive's public headers and runs without Lean or compiler tools on `PATH`.

## Exercised behavior

- All nineteen primitives in host callbacks and captured Lean functions, with six samples per type. Includes integer endpoints, 4,097-bit Nat/Int values, float NaN classification, infinities, signed zero, Unicode boundaries, UTF-8/NUL text and byte arrays.
- One- and sixteen-argument functions; typed invocation exports; two late callback arguments following mixed, aligned values in an indirect canonical record; the same token borrowed twice in one call.
- Returned Lean functions passed back as callbacks, callback reentry, nested aggregate results, and rejection beyond the 64-call limit.
- First callback failure, a result populated before failure, unchanged public output on error, and invalid callback results. A surviving Lean closure and host callback work after the helper replaces a trapped component store.
- Wrong thread, session and signature; retained call-borrow expiration; stale aliases after slot reuse; closing a callback during a double invocation; closing a session during a callback.
- 4,096 repeated component calls, 2,050 callback slot reuses, 1,024 simultaneous host tokens, and registry exhaustion while returning a newly allocated Lean closure. Shared native identity counts return to their starting values after cleanup.

The separate synthetic projection suite validates WIT and binary interface equivalence, canonical ownership, scratch-memory nesting, generated C compilation and two mutation oracles. It passes 11 tests. Its 825 synthetic calls are separate from the installed Lean counts. The [earlier projection record](wit-callable-projection-20260919.md) retains that milestone's scope.

The copied-value regression passes all four tests. Cobalt and Saffron each reproduce their archives from relocated source trees, then pass installed execution, shared-runtime, tampering, allocation-failure and atomic build-failure checks. All four archive hashes match the preceding [regression record](wit-callable-projection-20260919.md#regression-and-reproduction); copied-only output remains byte-identical.

## Ownership and recovery

Public callable tokens use the shared native runtime's full-width generation identities. Each session validates tokens and signatures before entering Wasmtime. A call pins its callable inputs, projects temporary Component Model resources and reclaims those proxies before return. Persistent Lean leases live outside Wasmtime's store, so the helper can replace a trapped store without destroying surviving functions.

Closing a token invalidates its aliases immediately. Active calls keep their references until return; callback data finalizers run once. An unreturned Lean lease belongs to the active call frame and is disposed on failure. A trap poisons the active nested call chain; store replacement waits for the outermost call to unwind.

## Scope and limits

The local run uses Lean 4.32.2, Wasmtime 42.0.1, wasm-tools 1.245.1, GCC 12.2.0 and an explicit glibc 2.36 test override. Published builds retain the glibc 2.38 requirement. WIT components here call native x86-64 Lean; their word width is 64 bits.

Callables are synchronous, have one through sixteen primitive arguments, and return a primitive. Host callbacks are call-borrowed; returned functions have explicit leases. No compound callable, resource-object or asynchronous coverage is added. Tokens cannot cross sessions. Callable packages require the owning session API rather than the copied-only custom-linker helper.

The session limit is 1,024 tokens, with an additional shared native identity capacity. Conversion work is bounded at 16 MiB and canonical scratch memory at 64 MiB; these are not process-memory limits. Wasmtime allocation APIs do not provide recoverable out-of-memory errors. Errors preserve the first diagnostic text, capped at 1,023 bytes, not a language exception object's identity. Process confinement is enforced by the host guard; this installed suite does not fork Wasmtime.

The inventory promotion covers 80 callable-position cells and 32 previously unverified reviewed primitive input/result cells. Existing copied-field and Char/platform-word evidence remains separate. No other consumer profile advances.

## Reproduce

```sh
export LEAN_BRIDGE_WASMTIME_C_API=/absolute/path/to/wasmtime-42.0.1-c-api
LEAN_BRIDGE_WIT_CALLABLE_TEST=1 node --test tests/wit-callables.test.mjs
LEAN_BRIDGE_WIT_CALLABLE_COMPONENT_TEST=1 node --test tests/wit-callable-contract.test.mjs
LEAN_BRIDGE_NATIVE_WIT_TEST=1 node --test tests/native-wit.test.mjs
```

Use `LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36` only when reproducing this local environment. CI runs these checks and uploads `build/callables/wit.json`. This milestone does not publish packages or lift the push hold.
