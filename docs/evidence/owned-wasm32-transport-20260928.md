# Owned values on wasm32

The private ownership transport now supports an explicit 32-bit Lean target.
The default remains 64-bit. Machine words use 32-bit storage on wasm32;
fixed-width 64-bit integers and opaque resource identities retain all 64 bits.

Lean boxes UInt32, Int32 and Char on wasm32. The output walkers validate those
boxes before unboxing, including constructor tag, object fields and payload size.
Char validation rejects surrogate code points and values above U+10FFFF.
Input and output pointers must also fit inside the current Wasm heap.

## Executed checks

```sh
LEAN_BRIDGE_OWNED_WASM32_TEST=1 \
  node --test --test-concurrency=1 tests/owned-wasm32-transport.test.mjs

LEAN_BRIDGE_OWNED_NATIVE_TEST=1 \
  node --test --test-concurrency=1 \
  tests/owned-native-values.test.mjs tests/owned-native-scalars.test.mjs
```

The Wasm gate compiles fresh Lean source, extracts its ownership contract, and
compiles typed carriers with the pinned PHP-Wasm Emscripten toolchain. A test-only
Zend entry point invokes the existing independent C probes inside PHP-Wasm 8.4.1.
It does not emulate a 32-bit target with a native process.

Each corpus executes in two fresh interpreters:

| Corpus | Transport checks | Wasm-specific checks | Allocation failures |
| --- | ---: | ---: | ---: |
| Nineteen primitives and nested optional units | 372 | 165 | 10 |
| Resource-bearing collections, records, variants and recursion | 30,039 | 18 | 92 |

All runs finish with zero live adapter allocations and broker identities, one
runtime initialization and one component initialization. The scalar probe checks
five malformed box shapes for each of nine boxed primitives. Its final scoped
failure retires the runtime, rejects further calls, and still releases resources
held before retirement. The recursive probe also checks captured Lean closures,
identity reuse, expired resources, cycles, depth limits and cumulative budgets.

The C probes remain unchanged except for the scalar fixture's explicit machine
word values. Test failures use unconditional checks, independent of PHP's
release-mode `NDEBUG` setting. Compiler-emitted constructor allocations pass the
same pinned-runtime allocation guard used by the existing copied Wasm transport.

Four frozen native generator hashes cover both corpora with host callback
generation enabled and disabled. Default and explicit 64-bit generation produce
identical complete artifacts. The native regression also reruns both C probes
with sanitizers and allocation-failure controls.

CI requires the new gate, propagates its failure through the PHP-Wasm observation,
and retains both `build/owned-wasm32/` reports. The source-history record preserves
the native PHP receipt unchanged and authenticates each shared-file transition
with its complete predecessor/current hashes. Type-table source hashes change;
installed support claims do not.

## Remaining integration

This milestone supplies the private wasm32 ownership transport. Public Zend
resource wrappers, PHP-Wasm host callbacks, ordinary/reviewed installed packages,
and Node/browser consumer acceptance remain to be implemented. Transferred inputs
and anchored results remain separate ownership work. Nothing was published to a
registry.
