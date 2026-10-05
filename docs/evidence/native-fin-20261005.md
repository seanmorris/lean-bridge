# C and C++ `Fin n` acceptance

VO1418 milestone under VO1220, 2026-10-05.

## Accepted boundary

Ordinary-source C and C++ packages accept top-level parameters and results whose elaborated Lean type is `Fin n`, or a transparent alias of `Fin n`, when `n` reduces to a closed natural-number literal. The extractor admits this only at depth zero for the `native-library-v1` profile. Every other native position still rejects `Fin`, as do the copied-graph, owned-aggregate and reviewed Binding IR transports.

The native model keeps the C transport as `Nat` and stores the exact decimal bound beside each export. Binding IR carries the same bound in `lean-lang.org/refinements`. A component with refined exports can be read only by a consumer that declares checked-`Fin` support, and only the C and C++ projections do. A build that also requests CPAN, PyPI, Cargo, RubyGems, NuGet, Maven, native PHP or WIT/WASI fails with `native-refinements-unsupported`.

## Checks at each surface

The package has three call surfaces, each checked independently:

1. **Public C and C++ API.** The C package uses GMP `mpz_t`, and the C++ package uses Boost `cpp_int`. A negative value is rejected by the existing `Nat` conversion. Any other value goes through the runtime table.
2. **Native runtime table.** After the existing copy validation, each `Fin` argument's little-endian uint32 limbs are compared with the exact bound before any argument is converted or Lean is called. The comparison allows high zero limbs. Bounds are stored as immutable `static const` arrays, so there is no cached Lean object, lifetime or thread-safety concern. A rejected argument returns `INVALID_ARGUMENT` with a message naming the bound.
3. **Exported Lean adapter.** The adapter symbol (`lb_<hash>`, visible in the component's dynamic symbol table) takes `Nat` and returns `Option`. It constructs `Fin` only inside a decidable `if h : a < n` branch; otherwise it returns `none` and does not call the source function. The runtime table maps `none` to `INVALID_ARGUMENT`. A `Fin` result is projected with `.val` after the source returns, so an export whose only refinement is its result returns the `Nat` directly.

The checks in surface 3 apply to direct calls of the exported adapter with Lean values the adapter can represent, as exercised below. They do not make arbitrary use of Lean's internal object ABI safe: calling other internal symbols or passing malformed objects is outside the public contract.

## Installed evidence

`LEAN_BRIDGE_NATIVE_FIN_INSTALLED_TEST=1 node --test --test-name-pattern="relocated source-free" tests/native-fin.test.mjs` builds the [fixture](../../tests/fixtures/onboarding/native-fin/NativeFin.lean) from real Lean extraction twice, in separate clean authoring roots. Both builds produced byte-identical archives:

```text
492e5494c714c0491ce3781bc5b209e434bf37d1665e917c264a093ad80b7271  archives/native-fin-1.0.0-c.tar.gz
05b4bbe2647dba4c692b42908ce2d25f90daebb1dae36f3a7d5c81a995b3b86b  archives/native-fin-1.0.0-cpp.tar.gz
```

The test verifies the package-set receipt and removes the authoring source. It then installs each archive offline into a clean consumer, compiles with `-Wall -Wextra -Werror` using only the package's pkg-config flags, runs the consumer, relocates the installation, and runs it again.

- **C consumer (2032 checks):**
  - `Fin 0`: every input is rejected.
  - `Fin 1`: only zero is accepted.
  - Bounds 10, 300 (through an alias) and 2^70: accepted at N−1, rejected at N, N+1, 2^32 and 2^128.
  - Negative GMP input is rejected.
  - A result-only `Fin 7` is checked.
  - A multi-argument `Nat × Fin 4 × String` call rejects the `Fin` argument.
  - Failed calls leave the output and caller-owned values unchanged.
  - 1000 alternating invalid and valid calls.
  - Raw `dlsym` calls to the exported adapters return `none` for 10 and 1000 against `Fin 10`, and for 0 against `Fin 0`, and return `some 6` for 3.
- **C++ consumer (2014 checks):** the same endpoints through the generated `Error` exception, including a negative `cpp_int` and the 2^70 bound, plus 1000 alternating recovery calls.
- **Dispatch observation.** This is a test-only probe. An `LD_PRELOAD` interposer counts calls to the Lean source functions (`l_NativeFin_mirror`, `l_NativeFin_impossible`, `l_NativeFin_label`) and to their exported adapters. The fixture and generated code are unchanged; the adapter reaches the source function through the PLT. The cumulative counts were:

| Step | Status | Source mirror / impossible / label | Adapter mirror / impossible / label |
| --- | --- | --- | --- |
| start | – | 0 / 0 / 0 | 0 / 0 / 0 |
| public valid mirror | OK | 1 / 0 / 0 | 1 / 0 / 0 |
| public invalid mirror, impossible, label | invalid | 1 / 0 / 0 | 1 / 0 / 0 |
| public valid label | OK | 1 / 0 / 1 | 1 / 0 / 1 |
| raw invalid mirror | `none` | 1 / 0 / 1 | 2 / 0 / 1 |
| raw invalid impossible | `none` | 1 / 0 / 1 | 2 / 1 / 1 |
| raw valid mirror | `some` | 2 / 0 / 1 | 3 / 1 / 1 |

The valid calls are the positive control: they show the counters are attached to real source dispatch. Rejected public calls reach neither the adapter nor the source. Rejected raw adapter calls reach the adapter but not the source.

## Admission and extraction checks

`LEAN_BRIDGE_NATIVE_FIN_TEST=1 node --test tests/native-fin.test.mjs` runs real Lean extraction and checks:

- the exact bounds 0, 1, 4, 7, 10, 300 and 1180591620717411303424 in the model and Binding IR;
- the generated adapter text, with no `sorry`, axiom, unsafe cast, panic or default;
- rejection without the consumer capability;
- the verified-component reader gate;
- rejection for PyPI, Cargo and RubyGems targets, alone or mixed with C or C++;
- rejection of `Fin` in an array, an option parameter, an option result, a callback argument and a product;
- rejection of an author-style reviewed Binding IR document.

## Not claimed

This record covers only the ordinary-source C and C++ parameter and result cells. It does not cover:

- other native languages;
- `Fin` in containers, records, variants, callbacks or returned closures;
- reviewed Binding IR;
- `Subtype`;
- nonliteral or dependent bounds;
- browser or Wasm profiles.

The C and C++ headers do not restate the bound; it is recorded in the packaged Binding IR. These runs used GNU m4 1.4.19, built from source into the test session because the execution container lacked m4; CI installs the distribution package.
