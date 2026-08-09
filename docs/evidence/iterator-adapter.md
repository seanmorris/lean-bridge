# Generated Iterator Adapter Evidence

Status: the JavaScript backend projects scalar streams as standard lazy `Iterable` and `AsyncIterable` values.

## Pull protocol

`compileIteratorV1` reads a synchronous iterator declaration from Binding IR and generates two private contracts:

- an owned, generation-safe iteration-state lease with deterministic `return()` cleanup and queued finalization; and
- a versioned pull frame with `value` and `done` states.

The private start function receives the declaration's copied scalar arguments and returns the iteration-state token. Each JavaScript `next()` call asks the native `next` symbol for one frame. The runtime validates the frame version, byte size, state, and copied item before returning `{ done, value }`.

The token, pull frame, native symbols, and cleanup calls stay inside the generated runtime. Package consumers use the language protocol:

```js
for (const value of range(4)) {
  console.log(value);
}
```

Completion releases the lease once. Early loop exit invokes `return()` and releases the same lease. Calls after closure return the standard done result. Runtime shutdown and queued finalization use the existing generated resource registry.

## Async pull protocol

`compileAsyncIteratorV1` uses the same owned iteration state with one stackless pending operation per pull. The runtime serializes `next()` calls, accepts each settlement exactly once, validates the delivered state and scalar, and exposes `Symbol.asyncIterator`.

```js
for await (const value of asyncRange(4)) {
  console.log(value);
}
```

An early `return()` cancels active native work before releasing the iteration state. Late settlement is rejected by the shared pending-operation registry. Runtime shutdown cancels pending pulls before it releases native iteration state and finalizes Lean.

## Current scalar profile

Version 1 supports booleans, integers through 32 bits, and 32-bit or 64-bit floating-point values. The backend coverage report rejects strings, bytes, records, resources, and generic items until their pull layouts exist.

## Executable checks

`tests/internal/abi/iterator-adapter.test.mjs` verifies generated ownership, frame layout, private-symbol requirements, nominal tag uniqueness, lazy pulling, serialized async pulling, exactly-once settlement, cancellation, completion cleanup, early-return cleanup, both iterator symbols, TypeScript iterable types, and direct package consumption.

The current native test stand-in writes synchronous frames and settles asynchronous pulls directly so tests can force every state. A cross-compiled Lean iterator fixture remains required for Wasm ABI evidence.
