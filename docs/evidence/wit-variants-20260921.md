# Installed WIT/WASI copied variants

VO1219 adds named WIT variants to ordinary-source and independently reviewed-IR
packages. The [machine record](wit-variants-20260921.json) binds source
contracts, original archives, parsed component types, installed execution and
separate synthetic cleanup probes. Base revision: `e1f76b0`.

## Public contract

Each concrete Lean family becomes a named WIT variant. Nonempty constructors
carry named records that preserve all original fields, including positional
fields disambiguated by the compiler. Empty constructors have no payload;
a single Unit field remains a record containing the singleton `unit` enum.
Aliases retain their names in parameters, results and variant payloads.

WIT text and the compiled Component Model binary are checked independently
against the reviewed source contracts. The manifest records original names,
types and WIT spellings. Keyword escapes apply only to WIT source. Runtime
callers use named Wasmtime discriminants and fields, without numeric tags or
Lean layouts.

## Installed execution

Both paths compile nineteen exports, ten families, 281 constructors, two
aliases and payloads covering all nineteen primitives. Each path passes
476,219 assertions across 1,936 calls, with 53 rejected inputs followed by
successful recovery. The installed executable runs twice.

The fixture includes nested arrays, Lists, records, options, results, products
and variant aliases. Integer checks cover exact ranges and 5,121-bit values.
Floating-point checks cover NaN classification, infinities, subnormals and
signed zero. Strings include Unicode and embedded NUL. Results have independent
storage and survive session closure.

A 257-constructor family exercises WIT's two-byte canonical tag. Lean 4.32.2
limits boxed constructor tags to 243, so cases above that boundary are empty.
All 257 cases execute through the installed component. A separate family mixes
32/64-bit integer and floating-point payloads. Parser checks cover all sixteen
core-scalar pairings, both sides of the sixteen-flat-argument boundary, and
variants sharing a component with primitive callable resources. Layout checks
also cover 1, 256, 257 and 1,024 cases; those larger synthetic layouts are not
claimed as compiled Lean acceptance.

Each author directory disappears before offline installation. The consumer
compiles using only packaged public headers, then relocates. Producer files,
handoff and installation project are absent during compiler-free execution.
All six loaded native libraries, the component and consumer executable retain
their original hashes. An independent rebuild reproduces the archive and all
68 packaged files per path, with identical observations. Temporary deployment
paths and consumer executables linked against those paths are not claimed
byte-identical across separate installations.

## Failure and cleanup checks

Installed calls reject unknown cases, missing or extra payloads, incorrect
field counts/names/order, wrong scalar types, malformed UTF-8, invalid Unicode
scalars, noncanonical big integers, nested bad branches and budget exhaustion.
Failed calls leave the output slot unchanged. The following valid call succeeds.

Separate synthetic C conversion probes pass AddressSanitizer,
UndefinedBehaviorSanitizer and LeakSanitizer with 688,008 assertions:

- 25 injected native scratch allocation failures.
- 113,855 input-budget and 108,251 output-budget failures.
- 19 malformed native outputs and 22 poisoned inactive payloads.
- A partial input failure after three scratch allocations, then recovery.
- Zero tracked live allocations after every failure and success.

These probes exercise generated converters against synthetic native values;
they do not establish real Lean execution. Wasmtime allocation APIs do not
expose recoverable out-of-memory errors.

## Reproduce

Use the pinned Lean, wasm-tools and Wasmtime C API described in the
[WIT build guide](../publish/wit-wasi.md). Run:

```sh
LEAN_BRIDGE_WIT_VARIANT_TEST=1 node --test --test-concurrency=1 \
  tests/wit-variants.test.mjs \
  tests/wit-variant-contract.test.mjs \
  tests/wit-variant-conversions.test.mjs
node --test tests/wit-variant-evidence.test.mjs
```

CI requires `build/variants/wit.json` and `build/variants/wit-conversions.json`.
Local installed acceptance uses the existing test-only glibc 2.36 override;
the release floor remains glibc 2.38. Installed aliases, Lists, compounds and
primitive callables also pass their unchanged regression suites on both paths.

Inventory 0.66.0 adds six WIT variant cells, bringing copied variants to
102/102 installed cells across all seventeen profiles and the full inventory
to 3,852/6,562 installed cells. The earlier declaration-only WIT observation
retains its array and record cells; the three reviewed variant cells now use
installed evidence. Other earlier observations and all historical artifact
identities remain unchanged. Recursive copied data, compound callable payloads and
explicit ownership for identity-bearing aggregates remain separate work.
