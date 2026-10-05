# JavaScript owned-value codec on wasm32

The private JavaScript codec now reads and writes the compiler-checked native
ownership layout. It keeps resource and closure identities in opaque host
handles, with 64-bit tokens confined to the transport.

The enabled layout, codec, registry and call-transport checks passed 43 tests:

```sh
LEAN_BRIDGE_OWNED_JS_WASM_TEST=1 node --test \
  tests/owned-javascript-wasm-layout.test.mjs \
  tests/owned-wasm-scalars.test.mjs tests/owned-wasm-values.test.mjs \
  tests/owned-wasm-registry.test.mjs tests/owned-wasm-calls.test.mjs
```

Emscripten checks every generated C size, alignment and field offset, including
the wasm32 pointer and 64-bit identity distinction. The value checks cover
arrays, lists, tuples, records, aliases, tagged variants, recursive values,
Options and Results. None, Some None and Some Unit remain distinct.

Conversion uses an explicit traversal stack. Limits cover value depth, visited
nodes, copied bytes and retained leaves. Tests reject malformed tags, missing
or extra fields, getters, sparse arrays, cycles, invalid identities and
unowned output spans. Reads and writes refresh their memory views after heap
growth; copied results retain no views into freed native storage.

Three enabled execution tests also passed through the reusable
`owned-wasm-calls.mjs` transport:

```sh
LEAN_BRIDGE_OWNED_JS_WASM_TEST=1 node --test \
  tests/owned-javascript-wasm-native.test.mjs
```

Those tests freshly compile the authored Lean aggregate and scalar fixtures,
extract their metadata, generate typed carriers, and link the adapters with
the browser-profile Lean runtime. JavaScript exercises all 19 primitive
representations, every aggregate shape, nested Options, deep trees and returned
Lean closures. An injected native allocation failure rolls back and allows a
later call to succeed. The tests now dispose result leases explicitly. They check
300 repeated scalar calls without accumulating owners, independent retention,
stale-handle rejection, and zero result owners, tracked allocations and resource
identities before component shutdown. The runtime initializes once.

Failed JavaScript publication and seven host-allocation checkpoints leave the
native allocation and identity counts unchanged. A later call succeeds using
the same component. Opaque native owner slots authenticate every output span and
identity; an identity from another result cannot pass merely because it exists
somewhere in the heap.

The registry and call-transport checks also cover:

- Transactional publication and rollback without invalidating existing inputs.
- Canonical live wrappers and independent `retain()` leases.
- Call-scoped borrows, explicit retention, expired borrows and foreign handles.
- Deferred release during closure self-disposal and reentrant component close.
- Queued finalizers, stale finalizer delivery and retired heaps.
- Native traps, malformed replies, allocation failure and first-error preservation.

## Synchronous host callbacks

Two additional tests compile the callback fixture from ordinary source and
independently reviewed metadata. The combined layout, codec, lifetime, call and
execution suite, including generated component bindings, passes 57 tests with
no skips:

```sh
LEAN_BRIDGE_OWNED_JS_WASM_TEST=1 node --test \
  tests/owned-javascript-wasm-layout.test.mjs \
  tests/owned-javascript-wasm-component.test.mjs \
  tests/owned-wasm-scalars.test.mjs tests/owned-wasm-values.test.mjs \
  tests/owned-wasm-registry.test.mjs tests/owned-wasm-calls.test.mjs \
  tests/owned-wasm-bindings.test.mjs \
  tests/owned-javascript-wasm-native.test.mjs \
  tests/owned-javascript-wasm-callbacks.test.mjs
```

JavaScript callbacks receive typed borrowed arguments. Borrowed handles expire
when the callback returns; `retain()` creates an independent lease. Reply pins
remain alive until C finishes converting the reply, including when a later
field validation disposes an earlier resource. Exceptions preserve their original
identity and unwind through typed Lean recovery values. Uninhabited result types
require an explicit valid recovery value. Promise replies are rejected.

Both source paths exercise all 19 scalar callback types, aggregate and recursive
replies, returned Lean functions, higher-order host callbacks, reentrant calls,
expired callbacks, cumulative budgets and component close during a callback.
The native scope limit admits 63 nested host entries. Sweeps of 47 native and
13 host allocation failures return to the pre-call owner and allocation counts;
later calls still succeed. Shutdown leaves no tracked owners, allocations,
identities or registered host callbacks and records one runtime initialization.

The callback broker caps generation counters at the wasm32 carrier width.
Identity tokens remain 64-bit; a host callback token cannot silently truncate
when it crosses a compiler-produced Lean `USize` parameter.

## Generated component bindings

The native entry points now come from `owned-wasm-component.mjs`, not the
test-only C adapter. Each component owns generation-safe result slots and exact
allocation-width receipts. Claims require both the right result owner and an
exact allocation base and size. Closing detaches the component from the broker;
an active native scope or registered callback prevents premature close.

`owned-wasm-bindings.mjs` uses one 64-byte control frame whose status field matches
the existing shared-loader trampoline. The compiler checks its offsets and
alignment. JavaScript preserves full-width identity tokens, refreshes views after
heap growth, validates replies, and retires the heap on traps or corrupted frames.
The execution harness uses these generated bindings; its remaining C additions
only inject allocation failures and read shared-broker diagnostic counters.
Raw C checks reject malformed control headers, invalid root spans, unknown and
stale result owners. Every actual output claim also rejects a foreign owner,
shifted allocation base and changed length. Repeated initialization preserves
existing result owners and runs Lean initialization once.

## Shared-runtime integration

The owned Wasm broker delegates initialization, retirement and shutdown to
`poc/lean-link-spike/main.c`. The existing runtime remains the sole owner of
Lean's core initialization and finalizer. Library initialization follows the
same path for copied and owned components. Shutdown rejects live legacy handles,
active calls, pending operations, result arenas, callable leases, attached owned
components, identities and host callbacks.

The shared-runtime test compiles that runtime and dynamically links an owned
component and the existing Alpha side module into one heap. It uses the actual
`createComponentRuntime` loader for the owned component. Both the ordinary-source
owned-first case and the independently reviewed legacy-first case passed. They
exercise resource-containing callback values, explicit retention, borrowed-handle
expiry, returned Lean functions, reentry, application exceptions and clean close.
Each records one core initialization, two library initializations and no tracked
owners, identities, allocations or legacy handles at the end. Normal shutdown
and deliberate retirement both prevent reinitialization.

Private ABI 10 binds the descriptor to a SHA-256 digest embedded in the compiled
control entry point. The digest covers the layout, declaration metadata,
initializer and callback dispatch key. The loader checks all eight digest words
before initializing the component. Unit checks reject descriptor substitutions,
preserve the original exception on a trap, and prevent allocator reentry into a
retired heap. Concurrent matching loads share one initialization.

The prepared-runtime build script now generates and links this broker. Its
isolated Nix source boundary passes the generator check. The shared callback C
source moved to a dependency-free module; both exported native source strings
remain byte-identical. An existing compiled, installed npm-package test also
passes with the expanded runtime JavaScript file set.

## Production artifacts and public functions

The production build passed for startup, lazy, browser and final-static profiles.
The final-static object identities still match the original lock. Compiling in
an alternate output directory exposed LLVM's filename-dependent object identity;
the build now supplies canonical input names rather than changing the lock.

Loading Alpha after core initialization now runs its library initializer through
the shared lifecycle. The coexistence harness no longer compensates by calling
that initializer itself. The complete private transport and legacy regression
suite passed 103 tests with no skips after this change.

Seven production-runtime tests passed, including both ordinary and reviewed
owned components. The latter tests now call generated, named JavaScript exports
rather than the private declaration dispatcher. Both load orders record one
core initialization, two library initializations and zero tracked identities
and attached components after cleanup. The public calls preserve callback error
identity, enforce argument counts, reject forged resources and support typed
recovery. This checks the generated entry point against real Lean execution;
it does not yet check an installed npm archive.

The standard JavaScript generator now accepts the checked ownership model.
TypeScript declares opaque resources and disposable native functions. Separate
input types admit host callbacks; callback arguments expose their borrowed
native values, with explicit retention. Strict TypeScript consumers exercise
nested Options, Unit, Results, recursive variants, aliases, big integers and
higher-order calls. Negative checks reject forged resources, numeric Nat values,
missing Option tags, non-Unit callback replies and undeclared numeric identities.
Public name collisions, reserved names and an exported `then` fail generation.
The audit rejects changed code, weakened declarations and additional public files.

Three more initializer regressions reproduced allocator traps that failed to
retire the shared loader, and cleanup that replaced the original failure. The
repaired loader quarantines the heap and preserves the first error. The focused
lifetime and loader suite passed 56 tests with no skips.

The public API run passed 135 tests with no skips in 213.12 seconds. It
includes the public generator and strict TypeScript checks, ordinary and
reviewed native execution, both shared load orders, seven production-runtime
checks, and the existing JavaScript generator and coverage regressions. Full
repository lint and checked-JavaScript typechecking also passed.

Installed ownership-aware npm packages and the canonical CLI build route still
need integration. The browser acceptance matrix, WIT/WASI ownership, transferred
inputs, anchored results and final cross-language acceptance remain in task 1219.
No support cells are promoted by this record.

A later cleanup audit reproduced a malformed legacy scalar reply reaching the
native deallocator with forged ownership bits. The shared scalar transport now
validates populated replies on success and failure before cleanup. Corrupt
replies retire the loader and quarantine their arenas. Valid input and status
errors still clean up normally. The new regression failed before the repair.
The combined execution after this repair passed 136 tests with no skips in
254.15 seconds, including both source paths and both shared load orders.

## Required execution and source history

The downstream workflow now requires the production-runtime build and all
17 test files from the combined execution. It enables both compiler gates,
rejects skipped tests, retains both logs and propagates failure to the support
summary. Mutation tests reject disabled gates, omitted test files, missing
observations and swallowed failures.

The companion `owned-javascript-wasm-integration-20260928.json` receipt binds
the successful execution and CI-contract logs to the current sources. Its
literal source transitions recover the preceding PHP-Wasm milestone byte for
byte. Unknown edits remain visible to historical verifiers. The PHP receipt
stays unchanged, and the type-surface index receives only current source hashes.
