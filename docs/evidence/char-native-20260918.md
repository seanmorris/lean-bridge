# Char in native and PHP-Wasm packages

VO1218 extends the npm Char milestone (`062757a`) to native hosts and PHP-Wasm. `Char` retains a distinct type identity even where its compiled representation shares UInt32's width.

| Consumer | Public representation |
| --- | --- |
| C | Checked `uint32_t` code point |
| C++ | `char32_t` |
| Rust | `char` |
| .NET | `System.Text.Rune` |
| Java / Kotlin | `int` / `Int` code point |
| Python | One-scalar `str` |
| Ruby | One-scalar UTF-8 or US-ASCII `String` |
| Perl | One-scalar text value |
| Native PHP / PHP-Wasm | One-scalar UTF-8 `string` |
| WIT / WASI | WIT `char`, `WASMTIME_COMPONENT_CHAR` in the C host API |

Scalar values include NUL, supplementary-plane characters, standalone combining characters and Unicode noncharacters. Surrogates and values above `0x10FFFF` are invalid. Text adapters reject empty and multi-scalar strings without normalization. Rust and .NET use scalar-safe public types; C, C++, JVM and WIT validate numeric inputs. PHP's conversion requires no mbstring extension.

## Installed acceptance

`tests/native-char.test.mjs` builds the eight-function `Glyphs` Lean library through ordinary source discovery and an independently specified reviewed contract. It compares compiler-owned signatures with that contract, verifies package-set receipts, removes author sources and build staging, and installs the prepared archives offline. Only host-language consumers compile after installation. Executed callers have no Lean or C compiler in `PATH`.

Each of the twelve profiles tests parameters, results, `Array Char`, nested arrays and record fields. Seventeen valid scalar cases cover UTF-8 width boundaries, surrogate-adjacent values, emoji, combining marks, NUL, tab and line endings. Dynamic hosts reject malformed values in all five scalar/container placements and recover afterward. Numeric hosts reject invalid code points. Rust and .NET cannot construct those invalid inputs through their public scalar types. Every profile repeats nested calls 1,000 times.

C additionally checks every integer from zero through `0x110000` against the installed `keep` function. WIT checks the packaged Component Model binary with `wasm-tools`, confirms its actual `char` declarations, and executes it through Wasmtime's public component API. Wrong WIT tags and invalid nested scalars fail without changing the output slot.

Native PHP executes weak and strict callers. PHP-Wasm executes twelve arrangements per source path: Node with embedded or Composer-installed APIs, plus Chromium with a Vite-bundled API, each with startup/lazy loading and weak/strict callers. Invalid Char input must not initialize lazy libraries. Successful calls load one component and one shared runtime. Chromium's network access is restricted to the local test server.

The local Linux x86-64 native checks use the explicit test glibc floor `2.36`; CI retains the production floor `2.38`. Local Perl acceptance uses the system Perl 5.36 interpreter. The CI matrix runs the same suite on its four pinned threaded/unthreaded Perl configurations; this local record does not claim those CI runs have completed.

Run the installed suites with the corresponding toolchains prepared:

```sh
LEAN_BRIDGE_CHAR_PROFILES=c,cpp,python,rust node --test tests/native-char.test.mjs
LEAN_BRIDGE_CHAR_PROFILES=dotnet,java,kotlin,ruby node --test tests/native-char.test.mjs
LEAN_BRIDGE_CHAR_PROFILES=perl,php-native,wit-wasi node --test tests/native-char.test.mjs
LEAN_BRIDGE_CHAR_PROFILES=php-wasm node --test tests/native-char.test.mjs
node --test tests/native-char-contract.test.mjs tests/component-char-contract.test.mjs
```

`build/char-native/*.json` records source paths, independent signatures, assertion counts, consumer source hashes, compiler-model identities and exact package archives. The committed [acceptance record](char-native-20260918.json) retains those identities without temporary workspace paths. Downstream CI gates and uploads each profile's report alongside its existing corpus evidence.

## Inventory scope

This milestone adds 72 installed cells: Char input/result/field positions across twelve native and PHP-Wasm profiles, on both source paths. The inventory records 812 installed cells out of 6,562 required cells. npm's existing twenty Char cells remain unchanged.

Callbacks, returned functions, npm containers, USize/ISize and older Alpha resource-oriented Char APIs are not promoted. Existing sixteen-primitive evidence retains its recorded archive identities; refreshed source hashes account for the additive Char branches. No package-registry release or production deployment is included.
