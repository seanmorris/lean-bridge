# Ecosystem-neutral local package verification

2026-09-15, VO1240 milestone based on `58dab6088f57d4740c0af32f1a1a4b27c78b84e0`.

Ordinary-source builds now produce `package-set-receipt.json` and its mandatory `package-set-receipt.json.sha256` sidecar. The installed Node-only `lean-bridge verify` accepts these files for npm, CPAN, C, C++, NuGet, Maven, RubyGems, WIT/WASI, PyPI, Cargo, native PHP and PHP-Wasm. Existing npm receipt versions 1 and 2 and signed archive receipts retain their formats and readers.

## Receipt contract

The version-one `lean-bridge-package-set-receipt` records:

- The Lean component and source-tree identity.
- Each compiled ABI profile's Binding IR and runtime identities.
- Each package's target, ecosystem, independent name and exact version.
- Whether a package provides, embeds or depends on its runtime.
- Exact dependencies within the archive set, and every artifact's relative path, byte count and SHA-256.

The writer sorts identities and paths independently of the process locale. The component display name can differ from its canonical ID, including mixed case or Unicode; the ID must retain the declared version. Combined builds verify each child receipt before combining its paths. A duplicate normalized package name within an ecosystem fails even if the versions differ. This includes JavaScript/PHP-Wasm npm names and native/PHP-Wasm Composer names. PHP-Wasm's Composer API requires both its npm extension and runtime. Maven groups its JAR and POM as one package.

The reader requires canonical JSON and the original adjacent sidecar. It rejects malformed or unknown fields, incompatible profiles and runtimes, unresolved dependencies, cycles, path traversal, duplicate paths, symlinked files or archive directories, non-regular files, changed bytes, and oversized inputs. Files are hashed incrementally; cancellation interrupts reads. Existing receipt or sidecar outputs are not overwritten.

Verification reports `verificationType: "local-package-set"` and `authenticated: false`. It checks declared metadata and archive bytes without unpacking or executing them. It does not authenticate a publisher, inspect package-manager metadata inside archives, or rerun Lean proofs. Signed verification still requires its complete option set and never falls back to a local check. The sidecar is an integrity check, not a signature.

## Node-only acceptance

```sh
node --test --test-reporter=spec \
  tests/package-set-receipt.test.mjs \
  tests/cli-verification.test.mjs \
  tests/toolchain-preflight.test.mjs
```

All 56 tests pass. The synthetic package-set fixture covers 16 packages and 17 artifacts across all three ABI profiles. Its bytes are inert fixtures, not installable packages. Negative cases include same-size archive corruption, missing archives and sidecars, receipt and sidecar symlinks, directory symlinks, metadata drift, runtime mismatch, dependency cycles and cross-profile name collisions. Output-conflict checks preserve an existing receipt or sidecar without creating its missing companion.

The CLI is packed and installed offline with lifecycle scripts disabled. It verifies package-set, npm v1/v2 and signed handoffs with only Node on `PATH`, invalid project configuration and unavailable compiler/runtime paths. Receipt and archive bytes remain unchanged. Malicious copied verifier scripts in the older handoffs are never executed. Filtered component and Perl engine startup checks also pass without a checkout fallback, catching missing files in their Nix source boundaries.

## Compiled package acceptance

The existing compiled suites now copy only receipts, sidecars and named archives into fresh directories. Node verifies those relocated copies without compiler staging, unpacked package sources or runtime configuration. Separate installed-consumer checks execute the public APIs.

| Release | Verified package set | Installed execution |
| --- | --- | --- |
| Shop | 13 packages, 14 archives, 2 ABI profiles | npm, CPAN, C, C++, NuGet, Maven, RubyGems, WIT/WASI, PyPI, Cargo and native PHP |
| Telemetry npm + CPAN | 4 packages, 4 archives, 2 profiles | Both installed APIs after hiding source trees |
| Telemetry npm + native PHP + PHP-Wasm | 6 packages, 6 archives, 3 profiles | JavaScript, native PHP and PHP-Wasm return `66` for the same input |
| Telemetry native PHP + PHP-Wasm | 4 packages, 4 archives, 2 profiles | Both PHP hosts; JavaScript runtime path deliberately unavailable |
| Telemetry npm + PHP-Wasm | 5 packages, 5 archives, 2 profiles | Both Wasm profiles |
| Willow and Aspen, independently | 3 packages and archives per component | All 88 exports across the two packages in Node and Chromium |

The native-only and npm-only child receipts also verify independently. Relocated builds reproduce their archive bytes and combined receipts. Reversing the three-profile target order preserves the combined receipt. The shared Telemetry API hash remains `73e9e4629ce4fb494dd34fddfc12c4f933bc555fc604db4068ffec79a94fb298`.

Local mixed-build checks use the real compiler through the existing injected Nix-command transport. They do not claim to run Nix locally. The native suites use the explicit glibc 2.36 test override; the production floor remains 2.38. Shop additionally needs MRI Ruby 3.3, JDK 22, .NET 8, Rust 1.90, Composer, Python and the pinned Wasmtime C API. The first Shop attempt selected system Ruby 3.1 and failed its prerequisite check. Repeating it with Ruby 3.3.12 passed all installed consumers in 416.5 seconds. Telemetry had already passed in 129.5 seconds.

```sh
source scripts/env.sh
export PATH="$PWD/.toolchains/ruby33/bin:$PWD/.toolchains/jdk22/bin:$PWD/.toolchains/dotnet:$PWD/.toolchains/rust-1.90.0/bin:$PATH"
export DOTNET_ROOT="$PWD/.toolchains/dotnet"
export LEAN_BRIDGE_WASMTIME_C_API="$PWD/.toolchains/wasmtime42"
LEAN_BRIDGE_MULTI_PROFILE_TEST=1 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  node --test --test-reporter=spec tests/multi-profile-project.test.mjs
LEAN_BRIDGE_PHP_MULTI_PROFILE_TEST=1 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
  node --test --test-reporter=spec tests/php-wasm-multi-profile.test.mjs
```

All four PHP mixed-target selections passed in 288.9 seconds. Each selected ABI compiles once and retains its own runtime. All profiles must succeed before the output directory appears.

```sh
LEAN_BRIDGE_PHP_WASM_ORDINARY_TEST=1 \
LEAN_BRIDGE_PHP_WASM_BROWSER_TEST=1 \
  node --test --test-reporter=spec tests/php-wasm-ordinary.test.mjs
```

The ordinary PHP-Wasm suite passed 4/4 checks with no skips in 186.0 seconds. It builds Willow and Aspen twice through an offline-installed CLI. That installed CLI also verifies their relocated package sets. Node executes embedded, Composer and Vite-bundled startup/lazy arrangements plus mixed loading. Chromium 152.0.7977.75 checks both modes under `/nested/app/`, with one fetch per library and no Lean library fetch before a valid lazy call. Missing or corrupt libraries and disabled loading fail explicitly without repeated loads. The exact Node and browser documentation examples still print `4294967295`.

The receipt is additive. These PHP-Wasm archive hashes match the preceding [lazy-loading milestone](php-wasm-lazy-20260915.md):

| Archive role | SHA-256 |
| --- | --- |
| Shared npm runtime | `4adf1d0f8308d163cb01ccf4068d5a23716762c4c6fad648866d931f7fb29b2e` |
| Willow npm component | `d10c7c1ff04a594ac3e451b4d77005561296ca569a4f97c3a62c56e94e6761a0` |
| Aspen npm component | `7e6d97dbbf4ee76a2ccd9c4e2a5ca142d1360354f2b94ad46d84a3ee059b4f12` |
| Willow Composer API | `dd4dcb49982895f433fbe2d8add3b4575b938008e5b83e9eaace384ba7d78817` |
| Aspen Composer API | `949be46a83b697e76a91def4ba701b6b321bcf72ed085478f06201757f659619` |

## Scope and follow-up

Core contracts pass 647 tests with 52 explicitly gated skips. Documentation checks pass 64/64, site/demo checks pass 111/111, and CLI packaging passes 5/5. Full lint, checked JavaScript, type-inventory validation, all 16 generated references, site typechecking and the production site build pass.

The [consumer handoff](../consume/receive-package.md#verify-a-local-package-set), [author handoff](../publish/local-handoff.md), consolidated PHP guides and CLI reference document the new receipt. Native package-manager publication instructions and signed Nix cache guidance remain in place. No registry-upload adapter, registry publication or new signed receipt format is added.

Installed type coverage remains 656 cells. The type inventory refreshes shared assembly/test hashes without promoting conversions or changing existing type claims. This milestone does not replace the broader VO1240 packaging audit, prepared compiler-input distribution, or the VO1217 cross-language corpus.
