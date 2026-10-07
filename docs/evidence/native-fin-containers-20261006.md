# `Fin n` inside arrays, lists and options of native packages

VO1427 under VO1220, 2026-10-06. It extends the [C and C++](native-fin-20261005.md) and [host](native-fin-hosts-20261006.md) scalar acceptance to `Fin` inside `Array`, `List` and `Option`.

## Accepted boundary

Ordinary-source native packages accept `Fin n`, or a transparent alias of it, inside `Array`, `List` and `Option` at top-level parameters and results, including nested combinations such as `Array (Option (Fin 10))` and `List (Array (Fin 10))`, when `n` reduces to a closed natural-number literal. The value crosses as the host's usual `Nat` container. The native model keeps the whole refinement tree beside the erased transport type; the compiled Lean adapter constructs each `Fin` inside a decidable check (`mapM` over arrays and lists, `match` over options), calls the source once, and erases container results after it returns. The shared C adapter validates the container structure first, then compares every present leaf with its bound before any Lean allocation, visiting only present option branches. A rejection names the parameter and the bound of the element that failed, for example `arg0 is not below its Fin 10 bound`, and leaves inputs and outputs unchanged.

`Fin` inside record and variant fields, callbacks, products (`×`) and `Except` stays rejected at the Lean source with a classified diagnostic, and a build that selects `cpan` for an export with a container bound fails with `native-refinements-unsupported` before any package exists. CPAN packages keep scalar bounds only.

The [fixture](../../tests/fixtures/onboarding/native-fin-containers/FinContainers.lean) exports `mirrorAll : Digits → Digits` (an alias of `Array (Fin 10)`), `countNone : Array (Fin 0) → Nat`, `sumHuge : List (Fin 2^70) → Nat`, `orDefault : Option (Fin 1) → Nat`, `present : Array (Option Digit) → Digits`, `flatten : List Digits → Option (List Digit)`, `label : Array String → Array (Fin 4) → String` and `wrapAll : Array Nat → Array (Fin 7)`.

## Installed evidence

Each run builds the fixture from two clean roots for the selected targets, requires byte-identical archives, verifies the package-set receipt, removes the producer, and installs each package offline without a Lean or C compiler. The consumer checks mirrored digits and the empty array, invalid first, middle and last elements, a 2^32 element, `Fin 0` with the empty array and with one element, the 2^70 list bound at its last value and at the bound, `none` and present values for `Option (Fin 1)`, present and absent elements of `Array (Option Digit)` including an absent invalid payload that is never read, nested rows and the empty list for `flatten`, the late refined argument with earlier inputs unchanged, result-only wrapping, and 1,000 rejection and recovery cycles. Hosts that can express malformed raw inputs (a negative value, a non-integer, an invalid option tag or a dangling span) check that those fail before any bound check.

The C run also compiles an `LD_PRELOAD` interposer and a probe that calls the exported Lean adapters directly with raw Lean arrays and options: valid public and raw calls reach the adapter and the source, rejected public calls reach neither, and raw invalid adapter calls reach only the adapter, which returns `none` without calling the source.

These runs used revision `f68cf7d` on Debian 12 (glibc 2.36).

### C and C++

`LEAN_BRIDGE_FIN_CONTAINER_PROFILES=c,cpp node --test tests/native-fin-containers.test.mjs` passed; the installed C and C++ consumers ran 2041 and 2039 checks. Both builds produced:

```text
26ceb45f0434875326d719c47bebb7b6e788ab439cfbfcb95cc5071afaff4591  archives/fincontainers-1.0.0-c.tar.gz
99feebe08b0dd5be5557975d40c7e0d93e9cb6ce7b373021cec97cf32035ce10  archives/fincontainers-1.0.0-cpp.tar.gz
```

### .NET

`LEAN_BRIDGE_FIN_CONTAINER_PROFILES=dotnet node --test tests/native-fin-containers.test.mjs` passed; the installed consumer ran 2026 checks. Both builds produced:

```text
641b9e8fa200063aadacdca88ca236762daaa15f286ddd7f2a8d97e04867ecb6  archives/FinContainers.Api.1.0.0.nupkg
```

### Java and Kotlin

`LEAN_BRIDGE_FIN_CONTAINER_PROFILES=java,kotlin node --test tests/native-fin-containers.test.mjs` passed; the installed Java and Kotlin consumers ran 2026 and 2025 checks. Both builds produced:

```text
f74567a0db3b3193234512e9d4c4a2e4d57e046abbe357b8a58a3c5ede00d5d8  archives/fincontainers-1.0.0.jar
92fac75f9c98c589f03820b64e50474ee00fdc076fdf49df2310712dfffd6dbf  archives/fincontainers-1.0.0.pom
```

### native PHP

`LEAN_BRIDGE_FIN_CONTAINER_PROFILES=php-native node --test tests/native-fin-containers.test.mjs` passed; the installed consumer ran 2026 checks. Both builds produced:

```text
54fe49a6dde55d0b6783a6d5d3e048d737bae79d9d90027ca78dc566db551b87  archives/example-fincontainers-1.0.0-linux-x86_64.zip
```

### Ruby

`LEAN_BRIDGE_FIN_CONTAINER_PROFILES=ruby node --test tests/native-fin-containers.test.mjs` passed; the installed consumer ran 2025 checks. Both builds produced:

```text
de14a0f4ffdcf843133f4c2ad65b38f1d9c6ea2a2ba374440a9aa28ee044aa03  archives/fincontainers-1.0.0-x86_64-linux.gem
```

### Rust

`LEAN_BRIDGE_FIN_CONTAINER_PROFILES=rust node --test tests/native-fin-containers.test.mjs` passed; the installed consumer ran 2027 checks. Both builds produced:

```text
0003624d46068b6ad84c789f868d7247a148a89995eb8c042d21d09d3a4f0ae3  archives/fincontainers-1.0.0.crate
```

### WIT/WASI

`LEAN_BRIDGE_FIN_CONTAINER_PROFILES=wit-wasi node --test tests/native-fin-containers.test.mjs` passed; the installed consumer ran 2033 checks. Both builds produced:

```text
5ef9c28cbb4263d972553e283f971ca9c6aa5538952ced2f8b4cc5392eb99fc5  archives/fincontainers-1.0.0-wit-wasi.tar.gz
```

## Not covered

- Python wheels run the same test, but the wheel installer requires glibc 2.38, which the machine used here lacks; their cells wait for a CI report.
- CPAN packages: container bounds are rejected for the `cpan` target; see the accepted boundary.
- `Fin` inside products, `Except`, records, variants, callbacks, nominal or recursive carriers, `Subtype`, reviewed Binding IR and browser profiles are outside this milestone.
