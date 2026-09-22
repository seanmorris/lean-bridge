# Compiled recursive copied-value adapters

VO 1219, 2026-09-22. Fresh Lean types now compile through typed carrier helpers
and bounded C walkers into an executable WebAssembly side module. The subsequent
[npm integration](npm-recursive-20260922.md) connects compiler admission, runtime
ownership and installed packages. Other consumer targets remain open.

## Typed construction and projection

[`component-recursive-lean.mjs`](../../src/build/component-recursive-lean.mjs)
generates a one-element `Array T` carrier for every source type, including
primitives. Lean checks cardinality before accessing an element, using a local
proof of the index bound. An empty carrier reports an invalid input or an
inapplicable constructor projection. Branch queries return an invalid ordinal
for malformed carriers. The C encoder checks carrier cardinality before using
any projection.

The helpers require no `Inhabited` instance, default constructor, `unsafe`,
axiom or admitted proof. They compile for an inductive type with no finite
inhabitant and for a recursive constructor placed before a leaf constructor.
Each nominal definition appears once. Aliases remain visible in public type
graphs but require no additional runtime traversal frames.

Array and List constructors validate every child carrier. Their projections
expose at most 262,145 children. The final extra child makes an oversized value
fail the transport's node budget rather than silently return a prefix. Input
sequence construction rejects more than 262,144 child carriers.

## Bounded C transport

The [private ABI validator](../../src/abi/component-recursive-abi.mjs) assigns
frame version 8 and dispatch `copied-graph-frame-v1`. It authenticates finite
definitions, reference roots and pure copied call semantics against public IR.
The shared runtime exposes separate version-8 frame validation. Existing frame
versions keep their previous behavior.

[`component-recursive-adapters.mjs`](../../src/build/component-recursive-adapters.mjs)
generates C walkers that use Lean constructors and projections through those
carriers. They never read source constructor tags or field offsets. All
arguments validate before any Lean values are allocated. Validation rejects
ancestor wire cycles, malformed tags, child counts and pointers. Bounds match
the JavaScript graph codec: 128 value edges, 262,144 value slots, and 16 MiB of
copied slots and payloads shared across arguments and the result.

Result encoding consumes its owned Lean carriers. A per-frame native allocation
ledger owns child tables and primitive buffers, including partial output.
Cleanup frees recorded allocations without following result pointers. A failed
call leaves a zeroed result slot. The loader authenticates output spans against
the native receipt and retires the shared heap on a trap or malformed output.

## Executed checks

The [fresh compiler test](../../tests/compiler-variant-metadata.test.mjs) compiles
the generated helpers into a native executable. It checks all nineteen
primitive fields, mutual recursion through Array and List, 128 recursive
constructor layers, aliases, record wrappers, Option and Except branches,
products, and distinct `none`, `some none` and `some (some ())` values. Empty
and multi-element carriers reject. Bounded Array/List projections and oversized
sequence construction execute at their limits. Long aliases and shared nominal
definitions compile without exponential expansion.

The [Wasm transport check](../../tests/helpers/recursive-wasm.mjs) links the fresh
Lean C output and generated walkers into the real shared runtime. It exercises
all primitives, independent copies of shared subtrees, zero- and two-argument
exports, cycles, invalid pointers/tags/counts, version mismatches and depth/node
budget failures. It verifies that an invalid second argument prevents decoding
the first. A 65,535-element forest fits the shared input/result node allowance;
65,536 elements fail without a partial result. Near-limit strings exercise the
16 MiB shared byte allowance. Oversized combined arguments reject before Lean
decoding; oversized results roll back without returning a prefix.

A [test-only ownership ledger](../../tests/fixtures/structured-types/recursive-ownership.c)
injects failure at every output conversion in recursive Tree and Envelope calls.
It tracks copied child tables and primitive payload buffers, rejects untracked
or duplicate frees, and requires zero live output allocations after every
failure and subsequent successful call. Repeated over-depth results also leave
the runtime usable. The ledger does not claim to instrument Lean's allocator.

Run after preparing the pinned runtime and relinking its current bridge:

```sh
bash scripts/build-lean-link-spike.sh --link-only
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 LEAN_BRIDGE_RECURSIVE_WASM_TEST=1 \
node --test tests/compiler-variant-metadata.test.mjs
```

The performance workflow also runs the compiled transport check after building
its pinned shared runtime. The shared compiler CI exercises the native carrier
executable without requiring an Emscripten installation.

Local checks pass: the fresh compiler, native helper and Wasm transport suite;
1,783 contract tests with 68 opt-in skips; 78 documentation tests; 111 site tests;
lint and root/site typechecks. The production site build passes. The existing
ordinary-source and reviewed npm record suites still execute successfully in
Node, strict TypeScript and Chromium page, React and worker consumers against
the rebuilt shared runtime. Installed C/C++ alias checks also passed after the
preceding metadata changes, including offline installation and relocation.

[npm integration and installed acceptance](npm-recursive-20260922.md) now cover
ordinary-source and reviewed archives. Next: extend installed recursive coverage
to the other consumer targets. Compound callable payloads
and explicitly owned resource aggregates remain required work.
