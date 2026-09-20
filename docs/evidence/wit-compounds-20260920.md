# WIT/WASI copied compounds

Prepared WIT/WASI archives preserve Lean `Option`, `Except` and nested binary
`Prod` values on ordinary-source and independently reviewed-IR paths. The public
interface uses WIT `option<T>`, `result<Success, Error>` and `tuple<A, B>`. `Unit`
keeps its singleton enum inside branches, so `none`, `some none` and
`some (some ())` stay distinct.

## Installed execution

Each path compiles the same 64-export Lean fixture. Compiler metadata, parsed WIT
and the compiled Component Model binary are checked against the independent
signature catalog. The consumer calls the packaged Wasmtime API, without the
private C adapter or Lean object layout.

The test verifies the original archive and its receipt, removes the producer
workspace, installs offline and compiles the C consumer from public headers.
It then relocates the application and removes the handoff and installation
project. Two runs execute with compilers, Lean and runtime overrides unavailable.
Every packaged native library must appear at its relocated path. Its hash, the
component hash and the consumer executable hash must remain unchanged.

Each execution passes 390,113 assertions across 4,826 calls, including 86 rejected
calls followed by successful recovery. The cases cover:

- All nineteen primitive payloads, integer endpoints, 129-limb arbitrary-precision
  values, Unicode and embedded NUL, bytes, NaN classification, infinities and signed zero.
- Both result branches, including asymmetric success/error types; two-position
  products with distinct values; nested options and Unit.
- Arrays, mixed record fields and 24 nested option layers, including absence at
  every depth. Returned values have independent storage and survive session close.
- Missing or wrong payloads, tuple arity, invalid Unicode/UTF-8, noncanonical
  natural numbers, malformed records and cyclic option pointers rejected before
  Wasmtime copies them.
- Three output-budget failures per run followed by store replacement and a
  successful call. Failure leaves the caller's result slot unchanged.

Both archives are named `archives/compounds-1.0.0-wit-wasi.tar.gz` in their separate
handoffs. Their SHA-256 identities are:

| Source path | SHA-256 |
| --- | --- |
| Ordinary source | `bf71759c2683245b41790aec70ba06327884b9bb6a4763d79ddaaece12526fa3` |
| Reviewed IR | `7b8724bee3e3f58b33c1e30fd18113837d6069b643a715abfa0c1e7907f860c5` |

The [machine-readable record](wit-compounds-20260920.json) contains complete
receipts, loaded-library paths, parsed declarations, compiler identities and
source hashes. Local execution used Lean 4.32.2, GCC 12.2.0, Wasmtime 42.0.1 and
wasm-tools 1.245.1 on Linux x86-64, with the explicit glibc 2.36 test override.
The supported CI profile remains glibc 2.38. Lean words are 64-bit even though
canonical component memory uses wasm32 addresses.

## Separate conversion and layout checks

A synthetic converter probe passes AddressSanitizer, LeakSanitizer and
UndefinedBehaviorSanitizer. Its 3,055 assertions include four injected scratch
allocation failures, 812 output-budget failures, eight malformed native outputs
and three unreadable inactive payloads. Partial output and scratch are released;
tracked live allocations return to zero. This probe does not execute Lean.

Parser contracts validate all sixteen pairings of the four canonical core scalar
types, mixed-payload alignment, and the sixteen-flat-parameter boundary. A
signature mutation must fail binary validation. The implementation follows the
[Component Model canonical ABI](https://github.com/WebAssembly/component-model/blob/main/design/mvp/CanonicalABI.md).

## Limits and remaining work

Copied type nesting stops at 32. Host conversion uses a 16 MiB accounting budget;
native copying has its own combined input/output budget. Component scratch memory
is capped at 64 MiB. These do not bound all Lean or Wasmtime working allocations.
Wasmtime allocation APIs do not expose recoverable out-of-memory errors. C callers
must supply valid storage; arbitrary dangling pointers are outside the C API contract.

Compound callback payloads still reject. Lists, aliases, arbitrary and recursive
variants and identity-bearing copied payloads remain separate work. This record
completes WIT/WASI's Option/Except/Prod round, not VO1219's full type-family scope.

Required consumer CI runs the installed suite, parser contracts and sanitizer
probe, retaining `build/compounds/wit.json` and
`build/compounds/wit-conversions.json`.
