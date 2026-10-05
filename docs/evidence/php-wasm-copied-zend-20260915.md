# Copied Zend boundary for PHP-Wasm

VO1216 now has a model-driven Zend source adapter for pure copied APIs. `generateCopiedPhpZendAdapter` consumes canonical Binding IR and emits PHP functions, readonly record classes, a private Zend extension source, a public C header, and a hash-bound source manifest. This milestone follows native PHP commit `4db53f3`.

## Executed boundary checks

```sh
bash scripts/bootstrap-php-wasm-ci.sh
LEAN_BRIDGE_PHP_WASM_ZEND_TEST=1 \
  node --test --test-reporter=spec tests/php-copied-zend.test.mjs
```

Both tests pass against PHP-Wasm 0.1.0, PHP 8.4.1 and Emscripten 3.1.68 at `ceee49d2ecdab36a3feb85a684f8e5a453dde910`. The execution check requires `PHP_INT_SIZE === 4`. A C static assertion rejects an adapter generated for the wrong PHP integer width.

Two synthetic APIs, Willow and Aspen, each expose 47 functions. They use different component identities and reversed record field orders. Each adapter compiles twice in relocated directories and produces identical Wasm bytes. Both extensions execute together in one real PHP-Wasm host and import its memory and function table.

The C test providers deliberately contain no Lean implementation. They isolate PHP validation, wire conversion, C ownership and failure cleanup. They compile separately from the generated Zend source, as component providers will. These checks do not establish ordinary Lean compilation, installed-package support, or runtime composition for ordinary PHP-Wasm projects.

| Test adapter | SHA-256 |
| --- | --- |
| Willow | `d11d7ffdeed63abe51d30e75fe329ca943c535d4ecf1ec91bb47f5bb04102448` |
| Aspen | `5fd9c22479442e8d6fa1845adc85aa6a9948f9c2ccb14946ab07395d3a154591` |

## Values and ownership

The tests cover all 16 copied primitives, lists of each primitive, nested lists of records, empty records, nullary functions and multiple arguments. Input callers omit `strict_types`; both the public PHP checks and private Zend wire boundary reject coercion.

| Lean values | 32-bit PHP-Wasm API | 64-bit native PHP API |
| --- | --- | --- |
| UInt32, Int64 | `BigInteger` | Range-checked `int` |
| UInt64, Nat, Int | `BigInteger` | `BigInteger` |
| Other fixed-width integers | Range-checked `int` | Range-checked `int` |

`BigInteger` carries canonical decimal text with at most 16,384 digits. Zend converts it to unsigned 32-bit limbs or fixed-width C integers without passing through PHP floating point. Tests cover extrema, 4,097-bit values, maximum-length decimals and independent low-word checks. Other cases include UTF-8 with NUL, arbitrary bytes, NaN classification, infinities, signed zero and Float32 rounding.

Each Zend call owns a bounded allocation scope and clears the native result after conversion. PHP validation and Zend conversion each account for up to 16 MiB; this is not a limit on all PHP or Lean working memory. Results become independent PHP records and lists. No Lean object layout or pointer enters the PHP API.

The suite injects failure at 80 allocation positions, rejects invalid native UTF-8 and excessive output lengths, checks native error codes and owned error text, and forces Zend bailouts during both the provider call and PHP output construction. After each bailout, the same PHP-Wasm host reports zero outstanding C allocations and executes another call successfully. The test also checks failure recovery after ordinary conversion errors.

The 64-bit native PHP path retains its existing mapping. Its installed Composer acceptance suite runs separately to verify that sharing the public API renderer and validation logic does not change those packages.

## Remaining integration

The PHP consumer CI job runs this boundary check alongside the existing transport checks. This milestone does not promote any ordinary PHP-Wasm cells in the type inventory; installed-tested coverage remains 656.

Next, compile ordinary Lean declarations and their per-type constructor/projection adapters for the pinned 32-bit PHP-Wasm ABI. Bind the generated Zend source to those compiled symbols, then package the runtime, components and PHP sources with startup and lazy loading. Acceptance must install unrelated, relocated packages and execute their actual Lean implementations before consumer documentation or type coverage claims change.
