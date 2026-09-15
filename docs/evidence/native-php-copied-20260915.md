# Ordinary-source PHP copied values

VO1216 adds self-contained Composer packages from ordinary elaborated Lean projects. This milestone is based on `0413a9d241574326e663112bcbe87cdcc25c318e`. The type inventory binds implementation and acceptance files by hash.

## Acceptance

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_PHP_TEST=1 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
node --test --test-reporter=spec tests/native-php.test.mjs
```

All four checks pass. The local profile uses PHP 8.2.33 NTS CLI, Composer 2.5.5, GCC 12 and glibc 2.36 on Linux x86-64. Lean 4.32.2 is pinned to `f3b06c705e6c85f5314019d5d3baab0fec5b580c`. Production packages retain the glibc 2.38 floor. The explicit local override does not establish production-platform execution.

Clover and Juniper each expose 43 functions, build from two relocated source trees, and produce byte-identical Composer ZIPs. Their record field orders differ, and their single-field records use different integer widths. Composer installs the archives into clean applications with network, plugins and scripts disabled. Applications run after relocation with no Lean or C compiler path. The documentation's artifact-repository installation runs separately.

Installed calls cover 16 primitive parameters, results, array elements and record fields, nested arrays, acyclic records, empty records, scalar-represented records, multiple arguments and nullary functions. Values include integer extrema, 4,097-bit magnitudes, Unicode with NUL, arbitrary bytes, NaN classification, infinities and signed zero. Integer codecs also round-trip the maximum accepted 16,384 decimal digits.

The caller deliberately omits `strict_types`. Generated checks reject coercion, overflow, invalid UTF-8, malformed lists and wrong classes. Validation also catches invalid records and big integers created through reflection without constructors. Tests inject scratch-allocation and result-conversion failures, inspect released owners, and verify subsequent calls. Native and PHP conversion-budget failures also recover.

Two independently installed packages initialize one shared Lean runtime and two components. Post-fork reuse, FFI-disabled execution, and foreign global or local Lean loaders are rejected. Removing one Composer package leaves the other executable. Changed native libraries fail both package assembly and installed hash checks; a failed PHP syntax-check command leaves no partial release.

## Reproduced archives

| Archive | SHA-256 |
| --- | --- |
| `example-clover-api-2.0.0-RC.1-linux-x86_64.zip` | `7414aec6f6865a84bd292f227c104604971118438f9d2940dda7d05ba53b03df` |
| `example-juniper-api-2.0.0-RC.1-linux-x86_64.zip` | `f21694c55a51decfe6e0edaab9be9ade03f839d03ea04b21d9c68365aa5255d2` |

The combined Shop check installs all eleven requested targets from one captured API, including npm and native PHP. It records one native compilation and one Wasm compilation. PHP shares the native component and C adapter with the other native projections.

## Scope

This profile uses PHP 8.2+ NTS CLI below PHP 9, Linux x86-64, readable `/proc/self/maps`, FFI and the package's glibc floor. It does not cover FPM, Apache, cli-server, ZTS, or PHP-Wasm. The previous Alpha Zend and PHP-Wasm APIs remain separate.

Only pure, concrete copied values with acyclic nesting of at most 32 types are admitted. PHP validation, FFI conversion and native copying have separate 16 MiB accounting budgets. PHP list conversion counts at least 32 bytes per element; the budgets do not bound Lean's working memory or every PHP allocation. `BigInteger` decimal input and output are limited to 16,384 digits. `finally` releases native results on PHP exceptions; fatal process termination cannot execute cleanup.

Packages include PHP sources, compiled libraries, native receipts and license notices. No consumer compiler, runtime path, per-package Zend extension or runtime scratch directory is needed. Readable native package files must remain installed. Native mappings stay loaded until process exit. Composer metadata does not infer the source library's redistribution license.

Ordinary PHP-Wasm, broader type families, the shared corpus (1217) and generic package-set verification (1240) remain open. Local combined-build tests use an injected Nix transport with real compilers, not an actual local Nix installation.
