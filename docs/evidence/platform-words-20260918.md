# Platform-sized Lean integers

VO1218 adds `USize` and `ISize` as distinct Binding IR primitives. Compiler metadata retains Lean's `size_t` representation and its `lean_box_usize` / `lean_unbox_usize` operations. A reviewed contract cannot substitute a fixed-width integer, even when it has the same width on one target.

| Compiled Lean target | `USize` range | `ISize` range |
| --- | --- | --- |
| npm and PHP-Wasm, 32-bit | 0..4,294,967,295 | -2,147,483,648..2,147,483,647 |
| Native packages and native-backed WIT, 64-bit | 0..18,446,744,073,709,551,615 | -9,223,372,036,854,775,808..9,223,372,036,854,775,807 |

The consumer's architecture does not change these ranges. Adapters reject invalid inputs before narrowing. Lean arithmetic wraps at the compiled word width. The copied C ABI uses stable `uint64_t` / `int64_t` carriers; the 32-bit Lean adapter checks the narrower range before conversion.

| Consumer | `USize` | `ISize` |
| --- | --- | --- |
| JavaScript / TypeScript, including browsers | `number` | `number` |
| C / C++ | `uint64_t` | `int64_t` |
| Rust | `u64` | `i64` |
| .NET | `ulong` | `long` |
| Java / Kotlin | `BigInteger` | `long` / `Long` |
| Python | `int` | `int` |
| Ruby | `Integer` | `Integer` |
| Perl | Unsigned integer scalar | Signed integer scalar |
| Native PHP / PHP-Wasm | `Brick\Math\BigInteger` | `int` |
| WIT / WASI | `u64` | `s64` |

## Installed checks

`Words.lean` exposes identity, decimal-text, increment and platform-width functions. Its native API also includes arrays, nested arrays and a record containing both word types. Identity proofs compile with the library. The fixtures declare their reviewed signatures independently of compiler output.

Both source paths compile fresh Lean, verify release receipts, and install the resulting archives offline. Native tests remove the author workspace and build staging before installation; npm tests relocate it. Consumers execute with no Lean or C compiler in `PATH`. Statically typed consumer programs compile against their installed host package.

All seventeen consumer profiles check scalar inputs and results. Native and PHP-Wasm profiles also check copied fields and containers, repeated calls, empty nested arrays, boundary values and exact decimal output. Dynamic hosts reject wrong types and overflow, including invalid nested values, and recover on the next valid call. Statically bounded host types prevent values outside their own 64-bit range.

The npm callers execute 2,217 assertions per context and source path in Node, Chromium, Firefox and WebKit. Each browser checks main-thread, React StrictMode and worker calls; strict TypeScript declarations compile and execute too. The raw Wasm slot test rejects noncanonical signed encodings, oversized values and invalid flags. A required runtime import prevents packaging word APIs against an older scalar runtime.

Native PHP tests weak and strict callers. PHP-Wasm tests twelve arrangements per source path: Node with embedded or Composer-installed APIs and Chromium with a Vite bundle, each with startup/lazy loading and weak/strict callers. Invalid input does not initialize lazy code; successful calls load one component and one shared runtime.

WIT checks the packaged component with `wasm-tools` and executes it through Wasmtime. Its wrapper is Wasm, but its Lean core is native 64-bit. The installed test queries the core's width and preserves both 64-bit boundaries through WIT `u64` / `s64` calls.

```sh
LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit node --test tests/component-words.test.mjs
LEAN_BRIDGE_WORD_PROFILES=c,python node --test tests/native-words.test.mjs
LEAN_BRIDGE_WORD_PROFILES=cpp,rust node --test tests/native-words.test.mjs
LEAN_BRIDGE_WORD_PROFILES=dotnet,java,kotlin,ruby node --test tests/native-words.test.mjs
LEAN_BRIDGE_WORD_PROFILES=perl,php-native,wit-wasi node --test tests/native-words.test.mjs
LEAN_BRIDGE_WORD_PROFILES=php-wasm node --test tests/native-words.test.mjs
node --test tests/word-contract.test.mjs tests/word-evidence.test.mjs
```

The [acceptance record](platform-words-20260918.json) retains assertion counts, caller hashes, compiler-model identities and exact archive hashes. Local native checks use Linux x86-64 with test glibc floor 2.36; CI keeps 2.38. Perl was executed locally on 5.36. Added CI checks have not yet run on the remote branch.

This milestone adds 184 installed cells, bringing the inventory to 996 of 6,562 required cells. Callback positions, returned functions, npm containers and older Alpha identity APIs are not promoted. No registry publication or production deployment is included.
