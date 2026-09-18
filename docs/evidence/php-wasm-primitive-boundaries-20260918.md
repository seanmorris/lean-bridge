# Installed PHP-Wasm primitive boundaries

The subsequent [Brick Math milestone](php-brick-math-20260918.md) replaces this record's package-local integer class and reruns the installed boundary suite.

VO1218 extends the ordinary-source copied-value acceptance and records its exact mappings in the type inventory. This milestone is based on `03a96e6ac8118b2434e2199dcc59188bbdb5f6b2`; the inventory pins the implementation and test files by hash. It changes the tests and support documentation, not the generated API or conversion implementation.

## Reproduce

Prepare the [PHP-Wasm author toolchain](../contributing/author-toolchain.md#php-wasm), Composer and Chromium, then run:

```sh
source scripts/env.sh
LEAN_BRIDGE_PHP_WASM_ORDINARY_TEST=1 \
LEAN_BRIDGE_PHP_WASM_BROWSER_TEST=1 \
LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME="$PWD/build/type-corpus/php-wasm-runtime" \
PLAYWRIGHT_BROWSERS_PATH="$PWD/.toolchains/playwright" \
node --test tests/php-wasm-ordinary.test.mjs
```

The runtime selector above reuses a verified local runtime. Omit it to build a fresh runtime from the prepared target archives. The recorded run passed all five tests in 170.2 seconds. It used Lean 4.32.2, Emscripten 3.1.68, PHP-Wasm 0.1.0, PHP 8.4.1 with 32-bit integers, Node 22.23.2 and Chromium 152.0.7977.75.

Willow and Aspen each expose 44 actual Lean exports, with different record layouts under the same Lean module name. A tarball-installed CLI compiles and packages each project twice after source relocation. The second build uses relocated standalone compiler inputs with the CLI's bundled inputs hidden. Every archive reproduces byte-for-byte. The suite installs npm and Composer archives offline, relocates the application, and hides author/build paths before consumer execution.

## Executed boundaries

The suite checks 115 primitive vectors through scalar input/result calls, arrays, record fields and nested arrays of records. It includes:

- Signed and unsigned extrema, both halves of `UInt32`, and values around `2^31`, `2^32`, `2^53` and `2^64` where the Lean type admits them.
- Exact `Nat` and `Int` values over 4,000 bits. Additional cases exercise the 16,384-digit decimal limit in each copied position and reject longer or noncanonical input.
- Binary32 rounding, binary32 and binary64 subnormals, infinities, both zeros and NaN classification. Recursive comparisons check float bits except for NaN payloads, which are not promised.
- Empty text, Unicode, embedded NUL, empty bytes and all 256 byte values. Invalid UTF-8, including overlong and surrogate encodings, is rejected.
- Wrong host types and integer overflow in scalar inputs, array elements and record construction. Subsequent valid calls must still work. Existing copy-budget, independent-result, empty-record and repeated-request checks remain enabled.

`UInt32`, `UInt64`, `Int64`, `Nat` and `Int` use the generated namespace's `BigInteger`, including small values. Tests compare its decimal contents exactly. They do not convert these values through PHP floats or JavaScript numbers.

Fourteen installed Node routes cover embedded PHP sources, Composer autoloading and Vite-bundled assets, with startup/lazy loading and one mixed-loading arrangement. Every arrangement runs weak and strict PHP callers. Four Chromium routes cover both loading modes and caller modes under a nested application URL, with external network requests blocked. Each route checks 88 exports, one runtime initialization, two components and 20 further requests. Public Node/browser guide files and loading failures run separately.

Consumers are real PHP files mounted into the host and loaded with `require`. Putting `declare(strict_types=1)` directly into PHP-Wasm's inline runner fails because that runner prepends statements. Both weak and strict files use the same generated API and value checks.

## Reproduced packages

| Archive | SHA-256 |
| --- | --- |
| Shared npm runtime, both libraries | `c04f0e88a6522fab805a619907eb1f5950df4fea2cecdd752ef6d94b6497cf94` |
| `example-willow-php-wasm-2.0.0-RC.1.tgz` | `454c1bcd1789f2a0fec0f47e3eca43ba843af4c727085c8a2e056dbe9b5041d1` |
| `example-aspen-php-wasm-2.0.0-RC.1.tgz` | `bbcd87ea5d721827fcdc1a8e585ac5f2149c779dadabf2016aa749660b4d32bb` |
| `example-willow-php-wasm-2.0.0-RC.1-php-wasm.zip` | `f5ec84c39328a80fa654bd25861b45d27ad296d4672e8c2e87e8c1b17cff78b3` |
| `example-aspen-php-wasm-2.0.0-RC.1-php-wasm.zip` | `ae2cb4a28f5306ef47a755853e7006b293bf66f3cce825f84ba4f0f3d99d7631` |

The shared runtime identity is `cf6fd0c4430e142677d32ae69d2f0585c667c1fcabb4b26a43c4d68789b48c5c`. Compiler inputs have identity `3981e67670c7c7ecf2eb96307640fe54f61c4b354873194907002ea6ff561ffd` and archive hash `ac7aa8e5e52631425acc80e541153994fb486c933dee2476e201ae866bf69796`. The type inventory records the complete runtime archive filename.

## Scope

This evidence adds 54 installed ordinary-source cells: sixteen primitives, arrays and records, each in parameter, result and field positions. Array-element cases run recursively within those APIs. It does not promote callback, closure, resource, effect, optional, variant, `Char`, `USize` or `ISize` support, or any reviewed-IR cell.

The generated `BigInteger` is a canonical-decimal value wrapper, not Brick Math integration. At this milestone, the older Alpha PHP-Wasm `int` API still had the upper-half `UInt32` issue tracked by VO1206. The separate [Alpha boundary repair](php-alpha-uint32-boundaries-20260918.md) now covers its resource, callback and returned-function mappings. VO1218 remains open for the remaining profiles, positions and type decisions. No registry publication is part of this acceptance.
