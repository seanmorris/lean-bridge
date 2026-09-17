# Shared native PHP corpus, 2026-09-17

VO 1217. Native PHP consumers install prepared Composer packages for `Shop.Pricing` and `Telemetry.Readings`. Separate weak and strict caller files use their public APIs. The harness compares their observations with fresh Lean results; neither caller receives those expected results. Production generators and the type-support inventory are unchanged.

## Public signatures and values

Each library exports 19 functions. Reflection checks names, parameter order, `mixed` parameters, declared return types and PHPDoc against the independently maintained catalog. Record checks cover final readonly classes, field order, property types, PHPDoc and constructor parameters.

`Nat`, `Int` and `UInt64` use the public `BigInteger` wrapper. Smaller integers and `Int64` use PHP integers. Exact integer cases exceed 4,096 bits. The caller converts floating-point wire bits without using a signed PHP integer as unsigned 64-bit storage. Finite values, signed zero, subnormals and infinities must match Lean bit-for-bit; NaN cases check classification. Bytes use the public `Bytes` wrapper; unit uses `null`.

Weak and strict caller files both reject numeric coercion. Invalid catalog inputs must produce the expected exception class and message at the public call or record constructor. Each rejection is followed by a valid call checked against Lean. Public calls are written in each caller file; changing only an entry point's `strict_types` would not test the included code's lexical caller mode.

## Copied values and rejection

Record results must be distinct from inputs, including their exact-integer objects. The caller constructs records from referenced populated and empty rows, changes those references, and checks that both input and output records retain their values. Mutating a local copy of output rows must leave both records unchanged. Direct mutation through readonly properties must fail. Weak references check that completed record calls do not retain their PHP input and output copies.

Supplemental cases cover nulls, numeric coercion, wrong exact-integer wrappers, raw strings passed as bytes, negative unsigned integers, non-list arrays, malformed UTF-8, reflection-forged records and integers, and input/output budgets. Each runs three times in each mode and is followed by a fresh-oracle recovery check.

These checks cover PHP copied objects, not native allocation counts. The [ordinary PHP suite](../../tests/native-php.test.mjs) retains its separate allocation-failure, loader-tampering, fork and package-composition checks.

## Installation and isolation

Both Lean libraries include local and pinned offline Git dependencies and three proved lemmas. The harness checks elaborated declarations, builds each Composer ZIP twice from relocated trees and compares exact archive hashes. It removes the author and oracle trees before verifying the relocated package-set receipt through the public CLI.

Each consumer starts with empty private Composer home/cache directories. It disables Packagist, network access, plugins and scripts, then installs only its exact prepared ZIP from a local repository. The locked and installed package lists must contain only the expected package. A second install must preserve the lock file and every installed byte.

The harness moves `vendor/` into a new deployment, writes its independent caller files and removes the entire install project, feed and cache. It executes each mode twice with INI files disabled, explicitly selected FFI, runtime overrides disabled and no compiler or Composer commands on PATH. The shipped PHP API and source provenance remain installed: this is an interpreted PHP consumer, not a source-free binary.

Reports identify the PHP executable, extensions and actual Composer implementation files. Composer's generated autoload maps are recorded separately and checked against the relocated installation. The package receipt binds every package payload; every included PHP file and loaded native library must come from the deployment with matching bytes. Repeated calls must produce the same observations, and execution must leave the deployment unchanged.

## Local results

The native PHP suite passes all 306 tests in 201.6 seconds. Across both libraries, 84 positive catalog cases match Lean and 40 invalid inputs reject and recover. Both modes execute that same 124-case catalog, for 248 mode-specific observations. All 264 supplemental rejection/recovery checks pass. Each of the four library/mode combinations executes twice, for eight PHP processes. Repeat processes do not count as additional coverage.

Four native builds reproduce both Composer archives. The standalone report records 41 scoped observed cells and 6,521 gaps. It is written to `build/type-corpus/php-native.json` and binds the catalog plus 42 source/harness files to corpus identity `faf6224ad17eccf26bb3ca5d9d02efc950b16bd8a04d9847fb16effe5deb19a1`.

The run used PHP 8.2.33 non-threaded CLI, Composer 2.5.5, Node 22.23.2 and Lean 4.32.2 (`f3b06c705e6c85f5314019d5d3baab0fec5b580c`) on x86-64 Debian 12. The Composer observation identifies 312 implementation files and four generated autoload maps. The local native glibc floor override was 2.36; production and CI retain 2.38. Nix is unavailable locally, so this record does not claim local execution of its pinned engine.

| Prepared Composer ZIP | SHA-256 |
| --- | --- |
| `lean-bridge-corpus-shop-corpus-1.0.0-linux-x86_64.zip` | `b7c78f7dce5744387df68bf2d71d240b9f656a27a11b39c593522213f21caf5d` |
| `lean-bridge-corpus-telemetry-corpus-1.0.0-linux-x86_64.zip` | `63bf4a800c1b51744ec9856955189a0181ff6f5fbb3cfd79f41d90ec6cb932fe` |

Both packages carry runtime identity `e7d08d91baf7f70d791a79bd611779d311201ce6b6530f478be4f8ff1113be1f`. Reproducibility compares builds with the same target selection. Combined-profile packages can have different hashes because their source configuration selects additional package targets.

The combined fifteen-profile regression passes all 306 tests in 1,131.7 seconds. Its 30 library/profile installations record 1,860 catalog cases: 1,622 executed, 178 rejected at compile time and 60 unsupported. Supplemental error/recovery checks pass: 264 PHP, 144 JVM, 60 .NET, 60 C/C++ and six Rust checks. The report records 570 scoped observed cells and 5,992 gaps.

The browser portion records 24 engine/variant executions, with 1,344 executed cases and 144 unsupported records. Both PHP modes execute all 248 mode-specific catalog observations. All adapters agree with the fresh Lean results; native and WASM runtime/IR identities remain separate. The combined run uses native and Perl glibc floor overrides of 2.36.

The combined report is `build/type-corpus/browser-javascript-browser-react-browser-worker-c-cpp-dotnet-java-kotlin-node-javascript-node-typescript-perl-php-native-python-ruby-rust.json`. Both reports revalidate against the same corpus identity and coverage rules. The harness removed its temporary build and consumer directories after execution.

Core validation passes lint, checked-JavaScript types and 1,014 tests, with 54 compiler/runtime-gated skips. All 65 documentation tests, 111 site/demo tests, the site typecheck, production site build and type-inventory check pass. The inventory retains 656 installed-tested cells and 29,530 required gaps.

## CI and remaining work

The PHP consumer job requires both the ordinary PHP suite and `npm run test:type-corpus:php-native`. It uploads `type-corpus-php-native-<commit>` from `build/type-corpus/php-native.json`; a failed check or missing report fails the gate. `test:type-corpus:all-native` includes ten native adapters sharing nine package formats. The [testing guide](../contributing/testing.md#shared-real-lean-type-corpus) lists tool selectors and prerequisites.

Fifteen of seventeen shared-corpus adapters are implemented. PHP-Wasm and WIT/WASI remain adapter gaps. Reviewed-IR execution and further type families, positions and semantics remain open. Synthetic validator observations never become installed evidence. This milestone does not promote type-support inventory cells or publish a registry package.
