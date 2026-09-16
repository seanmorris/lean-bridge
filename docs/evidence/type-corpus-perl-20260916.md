# Shared Perl corpus and declaration checks, 2026-09-16

VO 1217. The shared corpus now includes a Perl adapter that installs prepared runtime and component CPAN archives. It uses the same two Lean libraries and 124 inputs as the [Python/Ruby milestone](type-corpus-primitives-ruby-20260916.md), with explicit host-specific expectations. This milestone does not change the production generators or promote type-support inventory entries.

## Declarations and execution

The [catalog](../../tests/fixtures/type-corpus/cases.mjs) independently specifies all 38 function signatures, including nested array elements and named record fields. Before installing packages, the [harness](../../tests/helpers/type-corpus-native.mjs) compares those signatures with fresh compiler-produced native models from both relocated builds. Reports keep the declaration evidence and model hash separate from installed API observations.

The [Perl consumer](../../tests/fixtures/type-corpus/consumers/perl.pl) calls generated public functions and record constructors. It uses `Math::BigInt` for `Nat` and `Int`, native integer scalars for fixed-width values, the generated boolean helpers, `undef` for unit and packed octet strings for bytes. It checks the host representation of returned values, including Unicode flags, native booleans and exact integer scalars. Copied records and their nested arrays must remain independent when the input arrays are cleared. Perl records are mutable; the adapter does not impose Ruby's frozen-record rule.

Perl accepts a native boolean scalar as an integer input and an integer scalar as a floating-point input. Python and Ruby reject these inputs. The shared cases record these differences explicitly: **90 Perl results** must match fresh Lean execution, and **34 Perl calls** must reject invalid host values with the expected diagnostic. Python and Ruby retain 84 differential results and 40 rejections each. An unrelated exception cannot satisfy a Perl rejection case, and every expected rejection is followed by a successful recovery call.

Both Lean oracles include the numeric results for Perl's accepted calls. The report validator requires the complete oracle key set and resolves each profile's expectations separately. Python and Ruby cannot borrow Perl's acceptance policy or error handling. Floating-point cases compare exact result bits for finite values, signed zero and infinities; NaN cases compare classification without asserting payload bits.

## Prepared CPAN installation

Each library builds from two relocated workspaces. The harness checks byte-identical archives, unchanged source trees and matching compiler, source and binding IR identities. It then copies only the prepared archives and receipt to the consumer directory and deletes the author, oracle and unpacked build trees.

Perl installs both the runtime and component archives offline with `Makefile.PL` and make in `prebuilt-only` mode. Its installation PATH contains an allowlist of packaging utilities, with no Lean, Node or C compiler. API execution uses an unavailable PATH and disabled compiler/runtime overrides. The consumer checks that both modules loaded from its isolated installation prefix.

The harness reads installation receipts beside the modules selected by Perl's loader, including architecture-specific library directories. Both receipts must select prebuilt XS, match the compiled interpreter ABI and name the expected XS binary hashes. The consumer independently reads Perl's `Config` and computes its ABI fingerprint; that fingerprint must match the packaged variant. Reports record the interpreter version, ABI, separate runtime archive, component archive and installation evidence.

These checks cover prebuilt installation. The existing [Perl acceptance suite](../contributing/testing.md#consumer-acceptance) continues to test XS-only fallback installation and broader callback/resource behavior. This corpus does not turn those separate checks into coverage for unexecuted positions.

## Commands and CI

Run `npm run test:type-corpus:perl` for Perl alone. Set `LEAN_BRIDGE_CORPUS_PERL` to an absolute interpreter path to select another ABI. Run `npm run test:type-corpus:all-native` for Perl, Python and Ruby built together and checked against the same Lean results. The [testing guide](../contributing/testing.md#shared-real-lean-type-corpus) lists the other host prerequisites and commands.

Reports are `build/type-corpus/perl.json` and `build/type-corpus/perl-python-ruby.json`. They retain every inventory cell, including missing adapters and the reviewed-IR path. An observed cell names its executed cases and does not claim completion of all semantic requirements. The type-support inventory remains at 656 installed-tested cells.

CI runs the corpus on each existing Perl configuration: 5.36.3 and 5.38.2, each threaded and unthreaded. Each job uploads `type-corpus-perl-<configuration>-<commit>`. A failed corpus or missing report fails that job and the combined Perl support gate. Python and Ruby retain their separate corpus jobs. No generated package is published to a registry.

## Local results and artifact identities

The combined suite passes all 34 tests and **372 installed cases** in 320.3 seconds: 124 cases per profile across both libraries. Six installed API runs share each library's Lean oracle, binding IR and native runtime identity. Every prepared archive reproduces from the relocated source tree. The report records **123 scoped observed cells and 6,439 gaps**. The other 14 profile adapters, reviewed-IR execution and remaining positions and semantics stay open under VO 1217.

The run used x86-64 Debian 12, Node 22.23.2, Perl 5.38.2 threaded, Python 3.11.2, Ruby 3.3.12 and Lean 4.32.2, compiler commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`. Local native and Perl glibc floor overrides were both 2.36. Production and Ubuntu CI retain 2.38. The report records these two floor settings separately.

The catalog and its 15 source/harness files bind corpus identity `a506ebb4abe64288a7fb4d58831016387db562c99088a61034c5cfc6e24609ee`. The Perl ABI fingerprint is `4b52a460a64ff751914be31d06f9e7ef8c77e79819c34233bd0ad6a687b9661c`.

A separate Perl 5.36.3 unthreaded run passes all 34 tests and 124 installed cases in 170.8 seconds. Its ABI fingerprint is `8f3d6c67901e92e0245686ae64e3608d95ba676577af516db8ff421960336c8d`. Both reports revalidate against the same corpus identity. These local runs exercise two of the four CI configurations; they do not stand in for the full remote matrix.

| CPAN archive in the combined run | SHA-256 |
| --- | --- |
| `LeanBridge-Shop`, version `1.000` | `c38bff51516735f6b653c60d11ab89b1f0d05dd55b514010e62046596905edbe` |
| `LeanBridge-Telemetry`, version `1.000` | `b2f4350444d7cc6706f20e61312ae6b0d9e2336808cf2eb19a7eb4429aaec7c2` |
| `LeanBridge-Runtime`, shared by both components | `5ba874640af54583504cd2a77c3985ade94ff43c8f28f0809959234104936918` |

The report retains the complete filenames, runtime package version, sizes, XS hashes and Python/Ruby archive identities. All three profiles bind native runtime identity `e7d08d91baf7f70d791a79bd611779d311201ce6b6530f478be4f8ff1113be1f`.

Fast corpus validation passes 33 tests with one compiler-gated skip. `npm run check:core` passes lint, checked-JavaScript types and 742 tests, with 54 compiler/runtime-gated skips. All 65 documentation tests, 111 site/demo tests, the site typecheck, production site build and type-inventory check pass. These are local results; the four-ABI CI gate still has to run for this commit.
