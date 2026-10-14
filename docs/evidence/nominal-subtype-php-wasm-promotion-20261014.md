# PHP-Wasm nominal Subtype support

The [installed package archive](nominal-subtype-php-wasm-20261014/index.json)
verifies the tested Nat Subtypes in copied records and variants on wasm32 PHP.
Both ordinary-source and independently reviewed packages passed with full and
standalone result-only APIs. The producer was
`d121427862a7235b4e5e4a35a2355e56fc0f61f4`.

## Installed configurations

All four selections ran on Linux x64 with PHP 8.4.1, Node 22.23.2 and
Chromium 151.0.7922.34. Each selection includes eight Node contexts
(embedded and Composer installations, startup/lazy loading, weak/strict
callers) and four Chromium contexts (bundled installation, startup/lazy
loading, weak/strict callers).

| Original test output | Contexts with relocated replay | Checks per context | Expected refinement refusals per context |
| --- | --- | --- | --- |
| [Ordinary full API](nominal-subtype-php-wasm-20261014/ordinary-full/run.tap) | 12 | 4,254 | 1,032 |
| [Ordinary result-only API](nominal-subtype-php-wasm-20261014/ordinary-result-only/run.tap) | 12 | 2,112 | 0 |
| [Reviewed full API](nominal-subtype-php-wasm-20261014/reviewed-full/run.tap) | 12 | 4,254 | 1,032 |
| [Reviewed result-only API](nominal-subtype-php-wasm-20261014/reviewed-result-only/run.tap) | 12 | 2,112 | 0 |

Across the 48 contexts, each pass completed 152,784 caller assertions,
including 24,768 expected refinement refusals, 768 host-value refusals and
384 input-snapshot controls. Relocated replay repeats those checks.
Constructor/source entry counts and memory were not measured.

## Package and calling behavior

Two independent author roots reproduced the API, component and shared-runtime
archives for each selection. The author roots were removed before offline
installation. Weak and strict callers passed twice after moving the
installation. Package checks authenticate every archive member and installed
file, the loaded wasm32 runtime, and browser-served files against the original
archives.

Full APIs preserve each input site's checked constructor, including distinct
normalization choices for the same record. Only active variant payloads run
their constructors. Rejected inputs remain unchanged and later valid calls
succeed. Generated final readonly classes carry `Brick\Math\BigInteger` Nat
payloads without proof fields. Copied results require no input constructor
selection, including 100-bit Nat results and standalone result-only packages.

The archive retains all twelve complete packages, original compiler and
caller records, test output, the launcher, its pre-launch digest and the
independently verified runtime identity. It includes 50 selected producer
sources and the 24-module generator closure, authenticated against a frozen
5,605-input snapshot. The archive contains 280 files including its index.
Its registered checks reject 1,324 missing, corrupted or substituted original
files, semantic records and launch claims.

External toolchains and browser binaries are not retained. The local compiler
used the recorded Nix command transport adapter, not a Nix sandbox. Absolute
paths in launch records identify the original machine; checks read retained
repository files, not those historical paths.

## Support changes

Four installed-evidence entries supplement four existing PHP-Wasm Subtype
input/result cells and add two field cells across both author routes. Other
profiles, shapes and positions retain their previous claims, including the
separate PHP-Wasm Fin evidence.

Other primitive-base nominal fixtures, refined callbacks, owned values,
recursive graphs, dependent types and broader generic combinations remain
separate work. These local results do not establish hosted acceptance of a
later revision.

## Recurring checks

The [required PHP-Wasm workflow](../../.github/workflows/nominal-subtype-php-wasm.yml)
runs all four source/API selections serially. It builds the locked component
engine and shared Wasm runtime, retains complete or partial original records,
and rejects skipped tests, incomplete output or failed acceptance. The driver
checks tool and runtime identity and uses repository-relative paths.

Run the support and history tests with:

```sh
node --max-old-space-size=3072 --test --test-concurrency=1 \
  tests/helpers/nominal-subtype-php-wasm-promotion-tests.mjs \
  tests/helpers/nominal-subtype-php-wasm-promotion-history-tests.mjs
```

The exact source transition starts at
`08a9034d239cb9e753dde04dd53d712207811f3a`. Earlier evidence files and ledgers
remain unchanged.
