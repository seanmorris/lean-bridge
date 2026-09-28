# PHP ownership value declarations

The PHP value projection now covers explicit resource-bearing records,
variants, recursive values, arrays, lists, products, options, results and
transparent aliases. Native and PHP-Wasm ownership package admission remains
closed. These tests exercise PHP values, not compiled Lean calls or installed
Composer packages.

Generated records and variant constructors use readonly fields and exact,
named constructor arguments. Containers keep ordinary consecutive-key PHP
arrays. Options distinguish `null`, `Some(null)` and nested `Some` values.
Results keep separate `Ok` and `Err` constructors. Resource and closure wrappers
have private constructors, reject cloning and serialization, and delegate
scope checks, explicit retention, invocation and cleanup to their transport.

All 19 primitive types have strict, non-coercing validation. Nat, Int and
integers wider than PHP's signed range use Brick Math BigInteger. PHP integer
width and Lean machine-word width are independent. UTF-8 strings preserve NUL;
ByteArray uses Bytes. Char accepts one Unicode scalar. Float comparisons retain
signed zero and treat NaNs consistently.

The iterative validator enforces 128 levels, 262144 visits and a 16 MiB
accounted value-walk budget. It rejects cyclic arrays and objects, malformed
branches, uninitialized fields, foreign nominal values and invalid identity
wrappers. Shared acyclic children remain valid. Comparison and hashing walk the
entire value, including a malformed tail after an earlier mismatch. Identity
leaves compare by wrapper identity, not their private Lean contents.

The accepted value run passed all four tests without skips:

- Eight native PHP runs cover weak and strict callers and all four combinations
  of 32/64-bit PHP-value and Lean-word policies. The native interpreter itself
  is 64-bit.
- Two runs execute the 32-bit policy in the actual PHP-Wasm 8.4 interpreter,
  with both weak and strict callers.
- Together they perform 2346 checks, including 1036 rejection checks. A test
  binding exercises wrapper dispatch, closed values and borrow expiry. It does
  not implement native ownership.

Run both interpreter suites with:

```sh
LEAN_BRIDGE_OWNED_PHP_VALUES_TEST=1 \
LEAN_BRIDGE_OWNED_PHP_WASM_VALUES_TEST=1 \
LEAN_BRIDGE_PHP_WASM_HOST=/absolute/path/to/php-wasm \
node --test --test-concurrency=1 tests/owned-php-values.test.mjs
```

Reports are `build/owned/php-values.json` and
`build/owned/php-wasm-values.json`. Each records the executed probe and generated
source hashes. The Wasm report also records the loaded binary hash. The local
acceptance log is `build-owned-php-values-final.log`. Selected ESLint passed.

Next are native ownership, bounded aggregate conversion, typed callbacks and
returned closures, followed by authenticated Composer packages and source-free
installed tests. PHP-Wasm needs its own owned Zend transport and compiled
acceptance. JS/Wasm, selected WIT/WASI, transferred inputs and anchored results
remain part of VO1219.
