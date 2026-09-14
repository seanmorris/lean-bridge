# Ordinary-source C and C++ acceptance

Task 1216 adds copied primitive C/C++ adapters to the shared native compiler pipeline. The runtime profile is Linux x86-64, little endian, with Lean 4.32.2 at `f3b06c705e6c85f5314019d5d3baab0fec5b580c`.

## Installed packages

Run from the checkout after loading its tool environment:

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_C_TEST=1 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
node --test --test-reporter=spec tests/native-c-family.test.mjs
```

The local acceptance uses GCC/G++ 12, CMake 3.25.1, and glibc 2.36. The production package floor remains glibc 2.38. CI runs the same acceptance on Ubuntu 24.04 without the local floor override.

The four top-level tests passed. Mosaic exports 17 functions covering all 16 primitive parameter/result types and a zero-argument constant. Survey adds mixed-type arithmetic, string/Nat composition, and a compiler-resolved `UInt32` typeclass specialization. Both projects build from two different source locations. Their corresponding C and C++ archives are byte-identical.

Consumers extract the prepared archives, use their pkg-config and CMake metadata, and execute compiled C11 and C++20 applications with only `/usr/bin:/bin` on PATH. The original project paths are absent. An invalid, unused CPAN namespace and a deliberately unavailable Perl executable do not affect these C-only builds.

Checks cover exact unsigned maxima and signed minima, arbitrary integers through 16,384 bits, negative and zero Int values, IEEE NaN/infinity/signed zero, embedded NUL and non-ASCII UTF-8, malformed UTF-8, empty values, null output/input handling, overflowing lengths, the combined 16 MiB copy budget, repeated clear, C++ exception conversion and concurrent C++ calls. Copied output buffers never expose Lean objects. Native libraries stay loaded for the process lifetime; copied outputs use the generated clear functions or C++ ownership.

The package assembler reconstructs native semantics and Lean adapters from compiler metadata, checks the component/runtime/adapter hashes, and rejects modified libraries. An unsupported Array signature reports the Lean source position and leaves no release directory.

Exact locally executed archives:

| Archive | SHA-256 |
| --- | --- |
| `mosaic-c-2.0.0-c.tar.gz` | `f261751265bb66e3336ecc919e0ded3352f8390257e5e164abc958560dccbebe` |
| `mosaic-cpp-2.0.0-cpp.tar.gz` | `6e441beb6cf9a77c4b366594b4adf54581b781d88abe281a9ace0e270dedfef4` |
| `survey-c-2.0.0-c.tar.gz` | `d541910ea13c75f978ac85a3df2387e6c7b53126ff203db785bc0af14cf43c95` |
| `survey-cpp-2.0.0-cpp.tar.gz` | `620275d3d748101d9dd200d7fa0c38d413e4d7ebfac66081b51eb0d1fbe21aba` |

## Mixed profiles and regression coverage

`tests/multi-profile-project.test.mjs` builds the locked Shop dependency graph for npm, CPAN, C and C++. It verifies one Wasm and one native build per source location, compares relocated package sets, hides the source trees, and calls the installed APIs in all four languages. Telemetry retains the two-target npm/CPAN case. All seven checks passed locally with the native test floor set to 2.36.

The previous milestone's CI exposed a missing live dependency recheck: a compiler wrapper could change a path dependency after capture without rejecting the native release. That failure reproduced locally. `verifyLakeSnapshotSourceTree` now checks the complete live root and dependency inventory, including cached Git sources. `verifyLakeSnapshotProject` retains its root-only role for isolated engine inputs. Regression tests distinguish these two operations and cover local, Git, relocated and lock-absent projects.

The original CI suite, `LEAN_BRIDGE_LAKE_WORKSPACE_TEST=1 node --test tests/lake-workspace.test.mjs`, passed all 52 checks after the correction, including dependency mutation during C compilation. The full native Perl suite passed all 34 checks, including its 183 installed consumer assertions.

## Remaining scope

This milestone admits pure, concrete primitive functions. Ordinary C/C++ arrays, records, variants, resources, callbacks, effects and asynchronous delivery remain separate work. The existing reviewed Alpha C/C++ path remains available. The type inventory advances only the 16 ordinary-source primitive parameter/result cells for each of C and C++; it does not advance field, callback, other-platform or other-language cells.

Archives are prepared locally. This milestone does not upload them to a registry, publish npm packages, or deploy the documentation site.
