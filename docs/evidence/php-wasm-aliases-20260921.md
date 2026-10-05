# Installed PHP-Wasm aliases

VO1219 adds installed acceptance for 27 copied aliases on PHP-Wasm. The
[machine record](php-wasm-aliases-20260921.json) binds the unchanged shared Lean
fixture, independent wasm32 consumer, package archives and deployed files.
Base revision: `1c9975e`.

## Packages and public values

The 31-export fixture covers all nineteen primitives, alias chains, aliases used
only as results, copied records, Lists, arrays, nested options, results and pairs.
The Zend manifest preserves names and original targets. Both the component npm
archive and companion Composer ZIP include the same `lean-bridge/aliases.json`
catalog and README. Public PHPDoc retains the original parameter, result and
record-field contracts alongside PHP target types.

Aliases introduce no wrapper classes. UInt32, UInt64, Int64, Nat, Int and USize
use `Brick\Math\BigInteger`; ISize uses a signed 32-bit PHP integer. These rules
apply inside aliases, containers and records. The shared PHP and Zend conversion
sources remain byte-identical to the preceding implementation for the alias,
List and primitive-callable fixtures. Alias metadata changes the manifest;
alias-free Zend outputs remain unchanged.

## Installed execution

Ordinary-source and independently reviewed-IR builds each install three archives
offline: the component npm package, its exact runtime dependency and the
companion Composer ZIP. Empty caches, disabled install scripts and a second
locked installation rule out accidental producer dependencies. The harness
removes producer sources before installation, relocates the installed application,
then removes the handoff and installation project before executing consumers.

Each source path runs twelve arrangements, twice each in fresh PHP instances:

- Node with embedded declarations or Composer-mounted files.
- Chromium with a bundled descriptor under a nested URL.
- Startup or first-call loading, each with weak and strict PHP callers.

Every execution passes 12,544 public assertions on PHP 8.4.1 with 32-bit integers.
Checks include 5,121-bit integer magnitudes, full-width integer bounds, binary32
rounding, IEEE special values, Unicode scalars, embedded NULs and binary data.
Lean independently checks all nineteen fields of a scalar record and rejects
each changed field. Aliases retain Option presence, both result branches,
independent record and byte copies, order and duplicate values.

Malformed types, coercions, sparse or associative arrays, cyclic inputs and
over-budget copies reject, followed by a valid recovery call. The suite also
checks a native output-budget failure and a valid 30,000-byte result. Public
callers use no private transport entries. Installed declarations and catalogs
match the independent alias contract, and deployed file hashes remain unchanged.

Lazy hosts load neither Lean library during autoload or invalid input. The first
valid call loads each library once. Chromium requests match installed hashes.
Both paths use the same shared runtime archive.

## Separate Zend ownership probe

A synthetic provider wraps every copied site and nested field in 23 aliases,
including alias chains. It is not compiled Lean evidence. Both weak and strict
callers pass 147 assertions, covering 61 injected allocation failures, sixteen
partial nested inputs, ten malformed outputs and an empty poison pointer.
Native and partial-output PHP bailouts each recover in a later request with
zero live C allocations. Failing results retain their owned error text until
the adapter copies it. The ordinary installed suite above supplies the compiled
Lean acceptance evidence.

The first installed attempt exposed a loader allowlist that rejected the new
catalog path. The loader now permits exactly `lean-bridge/aliases.json` and
retains rejection tests for traversal, other filenames and invalid URL values.

## Regression checks

An independent rebuild reproduced all six archives, every package-owned file,
the alias catalogs and the synthetic probe binary. Existing PHP-Wasm List,
compound and primitive-callable installed suites pass for both source paths in
Node and Chromium. The callable suite used the prepared callable runtime and
the system Chromium executable.

The full contract run passed 1,591 tests with 67 gated skips. Site tests passed
111 checks and CLI packaging passed five. Lint, root and site typechecks,
reference checks and the production site build also passed.

## Reproduce

Prepare the [PHP-Wasm toolchain](../contributing/author-toolchain.md#php-wasm),
the pinned `php-wasm` 0.1.0 host, Composer 2 and Chromium:

```sh
LEAN_BRIDGE_PHP_WASM_ALIAS_TEST=1 node --test --test-concurrency=1 \
  tests/php-wasm-aliases.test.mjs \
  tests/php-wasm-alias-contract.test.mjs \
  tests/php-wasm-alias-zend.test.mjs
node --test tests/php-wasm-alias-evidence.test.mjs
```

CI requires and retains `build/aliases/php-wasm.json` and
`build/aliases/php-wasm-zend-faults.json`. Local Chromium was 152.0.7977.75.
Completed producer and consumer directories are removed between source paths.
No registry package was published.

This milestone promotes six PHP-Wasm alias cells, reaching sixteen of seventeen
profiles for copied alias parameters, results and fields. WIT/WASI aliases,
native variants, bounded recursive values, compound callable payloads and
explicitly owned identity aggregates remain in the structured-types goal.
Existing 32-level type and 16 MiB conversion limits still apply.
