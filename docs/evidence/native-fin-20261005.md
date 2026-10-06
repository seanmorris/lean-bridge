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

The implementation revision is `5866908`. The follow-up commit that adds the runtime-table probe and CI wiring rebuilt the packages and reproduced the same two archive hashes. The commit message for that follow-up records its revision.

The test verifies the package-set receipt and removes the authoring source. It then installs each archive offline into a clean consumer, compiles with `-Wall -Wextra -Werror` using only the package's pkg-config flags, runs the consumer, relocates the installation, and runs it again.

- **Public C consumer, GMP `mpz_t`:**
  - `Fin 0`: rejects 0 and 1.
  - `Fin 1`: accepts 0; rejects 1.
  - `Fin 10`: accepts 0 and 9; rejects 10, 11, 2^32 and −1.
  - Alias of `Fin 300`: accepts 299; rejects 300 and 301.
  - `Fin 2^70`: accepts 2^32, 2^70−2 and 2^70−1; rejects 2^70, 2^70+1 and 2^128.
  - Result-only `Fin 7`: 100 and 2^70 both map to 2.
  - The `Nat × Fin 4 × String` call accepts offset 3 and rejects 4.
  - Failed calls leave the output and caller-owned values unchanged.
  - 1000 alternating invalid and valid calls.
- **Public C++ consumer, Boost `cpp_int`:**
  - `Fin 0`: rejects 0 and 1.
  - `Fin 1`: accepts 0; rejects 1.
  - `Fin 10`: accepts 0 and 9; rejects 10, 11, 2^32 and −1.
  - Alias of `Fin 300`: accepts 299; rejects 300 and 301.
  - `Fin 2^70`: accepts 2^32, 2^70−2 and 2^70−1; rejects 2^70, 2^70+1 and 2^128.
  - Result-only `Fin 7`: 100 and 2^70 both map to 2.
  - The multi-argument call accepts offset 3 and rejects 4.
  - 1000 recovery cycles.
  - Rejections arrive as `Error` with status `INVALID_ARGUMENT`.
- **Runtime-table probe (test only).** The public GMP and C++ layers normalize integers before they reach the runtime table, so they never send high zero limbs. This probe therefore calls the installed table directly with raw caller limbs. An `LD_PRELOAD` shim records the table pointer the package passes to `native_fin_runtime_install_v1`, and the build's generated internal headers declare the table. The probe covers:
  - zero-length and zero-padded `Fin 0` input;
  - `Fin 1` zero with and without padding;
  - N−1, N and N+1 with and without high-zero padding for the bounds 10 and 300;
  - for 2^70 (limbs `{0, 0, 0x40}`): 2^32, 2^70−1 and padded 2^70−1 accepted; 2^70, padded 2^70, 2^70+1 and 2^96 rejected;
  - a multi-argument rejection;
  - 500 recovery cycles.

  Every rejection leaves the output struct byte-identical and dispatches no adapter or source call, according to the interposer counters.
- **Exported Lean adapters.** The dispatch probe compiles against the pinned Lean `lean.h`. It calls the adapters with boxed values: 10 and 1000 against `Fin 10`, and 0 against `Fin 0`, all return `none`; 3 returns `some 6`. It releases every returned object with `lean_dec`.
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
| raw invalid mirror (1000) | `none` | 2 / 0 / 1 | 4 / 1 / 1 |

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

The C and C++ headers do not restate the bound; it is recorded in the packaged Binding IR. The packages do not yet have an installed acceptance for multi-profile builds; the multi-profile entry point keeps the same target gating. These runs used GNU m4 1.4.19, built from source into the test session because the execution container lacked m4; CI installs the distribution package.
