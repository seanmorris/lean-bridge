# Standard PHP integer values

VO1218 replaces package-local decimal wrappers with `Brick\Math\BigInteger`. This milestone is based on `dc641ecd3160b03eef32bb7413d16d274bcb3f99`. The type inventory pins the implementation, tests and upstream source snapshot by hash.

## Dependency and public API

Generated Composer packages require `brick/math` 1.0.0. PHP-Wasm npm packages include the same upstream PHP sources and register their autoloader automatically. Consumers need no GMP or BCMath extension. The source snapshot contains the upstream MIT license, package metadata and all 23 PHP source files from [Brick Math 1.0.0](https://github.com/brick/math/tree/1.0.0), commit `2effe05d2177c451b86c6a073196a4034c02f211`. Builds validate every retained source hash without downloading the dependency.

| Lean value | Native 64-bit PHP | PHP-Wasm, 32-bit PHP |
| --- | --- | --- |
| `Nat`, `Int`, `UInt64` | `Brick\Math\BigInteger` | `Brick\Math\BigInteger` |
| `UInt32`, `Int64` | `int` | `Brick\Math\BigInteger` |

Use `BigInteger::of('18446744073709551615')` to construct an exact value. Arithmetic methods such as `plus()` and `negated()` work on Lean results. Independently generated packages accept the same integer object. There is no package-local `BigInteger` alias or `fromDecimal` constructor.

Brick normalizes accepted numeric text before the Lean boundary. For example, `of('-0')` yields zero and `of('01')` yields one. Generated calls require an actual `BigInteger`, check canonical decimal output, enforce the Lean type's range and retain the 16,384-digit conversion limit. Raw PHP integers, floats, strings and `BigDecimal` objects are rejected where the public API requires `BigInteger`, including weak callers. Applications can bound parsing of untrusted text with `BigInteger::parse($text, allowedSyntax: [], maxDigits: 16384)`.

Composer resolves the declared dependency through the application's repositories. Offline tests serve the exact upstream files from a local Composer repository, disable network access and check the resulting lockfile and installed source hashes. Applications should retain their Composer lockfile and make locked dependencies available for offline deployment.

PHP-Wasm's npm descriptor mounts the bundled classes once. Its extensions-only descriptor leaves PHP autoloading to Composer. The shared loader identity includes the bundled dependency hashes, so a dependency change produces a new runtime-package identity.

## Installed acceptance

The native suite passed 4/4 tests on PHP 8.2.33 NTS, Composer 2.5.5 and Linux x86-64. Clover and Juniper each reproduce their Composer archive after source relocation. Compiler-free consumers check exact integers, range and copy limits, weak-mode rejection, recovery, cleanup and automatic shared loading. An integer returned by Clover passes directly into Juniper and supports Brick arithmetic. The local glibc override is 2.36; production packages retain their 2.38 floor.

The ordinary PHP-Wasm suite passed 5/5 tests with PHP-Wasm 0.1.0, PHP 8.4.1, Node 22.23.2 and Chromium 152.0.7977.75. Willow and Aspen each expose 44 Lean functions. Fourteen installed Node arrangements and four network-isolated Chromium arrangements cover bundled sources, Composer, Vite, startup/lazy loading, and weak/strict callers. The existing 115 primitive vectors and maximum-decimal cases still pass. Willow's returned integer passes into Aspen without conversion.

Two focused dependency checks pass with Composer autoloading and the npm-style bundled autoloader. Two compiled wasm32 Zend checks cover exact conversions and failure cleanup. Alpha's installed native suite passes 126 checks in each caller mode; startup and lazy PHP-Wasm each pass 154 checks in each caller mode. These include the full `UInt32` range in resources, payload fields/elements, callbacks and returned functions, followed by zero live resource identities.

Both Wasm profiles pass the cross-component composition check. Native, startup Wasm and lazy Wasm retain semantic observation SHA-256 `da226e8f97d2a8b20835af9ea6476ee90ffd40c3d72073a0ef5a5b4c67ec67d1`. The parity check also validates each profile's generated reflection, assurance and documentation against fresh expectations.

The reviewed combined-build suite passes four target selections across JavaScript, native PHP and PHP-Wasm. It checks one compilation per ABI, target-order independence, relocated offline consumers and portable receipt verification. This local check uses an injected Nix transport with real compilers; it does not execute Nix.

## Shared corpus

Ordinary-source and reviewed-contract runs each pass all 124 catalog cases for native PHP and PHP-Wasm. Every run builds Shop and Telemetry twice, removes author sources before installation, and compares the installed API with a fresh Lean oracle. Native runs cover strict and weak callers. Each Wasm run executes 24 loading/caller arrangements across Node and Chromium. The report auditor binds loaded PHP files to their Composer or npm source hashes, including the bundled bootstrap and Brick classes.

The four reports retain 41 observed cells each. They do not turn those observations into complete type-family coverage; the inventory remains at 720 installed checks.

| Report under `build/type-corpus/` | SHA-256 |
| --- | --- |
| `php-native.json` | `58e467eb8d80ceeb5288415add43038bda0ab16f194124707af9d6bcc6e92bfc` |
| `php-wasm.json` | `62fee18d341e2627343f0e440ff29d0d5acccab3e757187a37f5fdf26b9aa2cb` |
| `reviewed-native-php-native.json` | `fb16d18e2de147ed7e1c8f015894376028bd4f5c026b29572ba8f4214651e50d` |
| `reviewed-wasm-php-wasm.json` | `ceccc74c0c6151e9ed2ec3ebd29c462ce5a3f5be1cf7a918a843359444523624` |

## Reproduced archives

These are local acceptance artifacts, not registry publications.

| Archive | SHA-256 |
| --- | --- |
| `example-clover-api-2.0.0-RC.1-linux-x86_64.zip` | `3377b14e98c1a5deb89b8acdcaab6088a717859a561ed87c7c96edc36ccd90a0` |
| `example-juniper-api-2.0.0-RC.1-linux-x86_64.zip` | `49b6642cd7da7dd044a2c012327bda5b190dc64e90a64f6f8b7d9439e87682f2` |
| Shared PHP-Wasm npm runtime | `f3db595875924f7532a91c4d6058d7588144a591476d6c192035530970b88847` |
| `example-willow-php-wasm-2.0.0-RC.1.tgz` | `5c983387cc6b2d0aa52aec175f4cfae4ffda09f65e65bd9316a6b8247cdc60c6` |
| `example-willow-php-wasm-2.0.0-RC.1-php-wasm.zip` | `430f7846f401195530683f2e8189d09caa7d6282cbb728d2b8611f4ac97ebbfb` |
| `example-aspen-php-wasm-2.0.0-RC.1.tgz` | `311d6512d929cfc3536b28cf90ff7406031a911178ce86bdf8adcc598d0792a2` |
| `example-aspen-php-wasm-2.0.0-RC.1-php-wasm.zip` | `484da08c1fb17fa7f8b29719f10e330a92e080e13df29960ebdb2fec8fbebf33` |

## Reproduce

Prepare the [PHP author toolchains](../contributing/author-toolchain.md#php-wasm), Composer and Chromium, then run:

```sh
source scripts/env.sh
node --test tests/php-brick-math.test.mjs
LEAN_BRIDGE_NATIVE_PHP_TEST=1 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
node --test tests/native-php.test.mjs
LEAN_BRIDGE_PHP_WASM_ORDINARY_TEST=1 \
LEAN_BRIDGE_PHP_WASM_BROWSER_TEST=1 \
LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME="$PWD/build/type-corpus/php-wasm-runtime" \
PLAYWRIGHT_BROWSERS_PATH="$PWD/.toolchains/playwright" \
node --test tests/php-wasm-ordinary.test.mjs
```

The runtime selector reuses a verified local runtime. Omit it to build from the prepared target archives. The [Alpha acceptance commands](php-alpha-uint32-boundaries-20260918.md#reproduce) exercise resources and callbacks separately.

To rerun the shared corpus and combined build:

```sh
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36
export LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME="$PWD/build/type-corpus/php-wasm-runtime"
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.toolchains/playwright"
LEAN_BRIDGE_TYPE_CORPUS_PROFILES=php-native node --test tests/type-corpus.test.mjs
LEAN_BRIDGE_TYPE_CORPUS_PROFILES=php-wasm node --test tests/type-corpus.test.mjs
LEAN_BRIDGE_REVIEWED_NATIVE_PROFILES=php-native node --test tests/type-corpus-reviewed-native.test.mjs
LEAN_BRIDGE_REVIEWED_WASM_PROFILES=php-wasm node --test tests/type-corpus-reviewed-wasm.test.mjs
LEAN_BRIDGE_REVIEWED_MULTI_PROFILE_TEST=1 node --test tests/php-wasm-multi-profile.test.mjs
```

This change preserves existing support stages. It does not add `Char`, `USize`, `ISize`, arbitrary callback signatures, optional values or asynchronous delivery.
