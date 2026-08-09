# Generated Iterator Adapter Evidence

Status: the JavaScript backend projects synchronous scalar streams as standard lazy `Iterable` values.

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

## Current scalar profile

Version 1 supports booleans, integers through 32 bits, and 32-bit or 64-bit floating-point values. The backend coverage report rejects strings, bytes, records, resources, generic items, and asynchronous iteration until their pull or pending-operation layouts exist.

## Executable checks

`tests/iterator-adapter.test.mjs` verifies generated ownership, frame layout, private-symbol requirements, nominal tag uniqueness, lazy pulling, completion cleanup, early-return cleanup, `Symbol.iterator`, TypeScript `Iterable<T>`, and direct package consumption.

The current native test stand-in writes the versioned frame directly so tests can force every pull state. A cross-compiled Lean iterator fixture remains required for Wasm ABI evidence.
