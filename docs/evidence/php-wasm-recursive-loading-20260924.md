# Recursive PHP-Wasm reproduction and shared loading

The [execution record](php-wasm-recursive-loading-20260924.json) extends the
[installed-package record](php-wasm-recursive-packages-20260924.md) without
changing its receipts. The accepted coverage inventory remains unchanged.
The later [shared-source regression record](php-wasm-shared-regressions-20260924.md)
checks the wasm32/graph source transitions against the original implementation.
Native-backend regression closure and final cross-language acceptance remain open.

## Independent reproduction

A fresh runtime and two new Lean projects reproduce the original ordinary-source
and reviewed-contract npm archives and Composer ZIPs byte for byte. The check
also compares compiler metadata, generated sources, compiled libraries,
installed file inventories and public results. It repeats all 24 Node and
16 Chromium executions after offline installation, relocation and producer
removal. Each caller passes 1,448 assertions and 35 rejection checks across
eighteen exports, then handles twenty further requests.

Reproduction compares two builds in the same compiler and packing environment.
CI first creates its own installed-package report. It does not require archives
made with another Node, zlib or ICU version to have the same package identity.

## Shared runtime

Four freshly compiled packages provide two recursive APIs, one acyclic API and
a conflicting build of the first recursive API. Their original npm archives
install offline with one shared runtime. The three compatible Composer ZIPs
install with Brick Math. The test verifies installed files, relocates the
consumer and deletes source projects, release trees, archive feeds, compiler
outputs and the temporary runtime tree before execution.

Thirty-six Node composition cases cover descriptor-mounted PHP, Composer
autoloading and Vite bundles; startup, lazy and mixed loading; weak/strict
callers; and graph-first/peer-first call orders. A separately evaluated duplicate
descriptor must reuse the same libraries. Each caller passes 659 PHP assertions,
including recursive round trips, nominal-type rejection, copied-result
independence and permanent runtime retirement. Twenty additional requests
reuse the initialized runtime before retirement.

A test-only Zend probe reads the production broker. Every composition caller
observes one runtime initialization, three component initializations and zero
live identity handles. It then retires that runtime. Calls through both graph
packages and the acyclic package reject with status 5, while previously copied
PHP values and the PHP interpreter remain usable. The test does not expose
these probe functions in a consumer package.

Four conflicting-build cases cover both registration orders and startup/lazy
loading. Each rejects before any library fetch, then confirms that the selected
build works alone in a fresh interpreter. Eight weak/strict failure cases cover
disabled loading, missing registration, a missing component and a missing
runtime. Errors preserve the caller's PHP error handler. A failed link stops
later attempts through either recursive or acyclic peers; PHP itself still runs.

Chromium repeats both call orders in four loading/caller configurations, twice
each in fresh contexts. These sixteen host executions use a nested deployment
URL and reject external requests. Request hashes identify the original installed
PHP sources, runtime, component libraries and test probe. Consumer files remain
unchanged after all Node and browser runs.

## Retained evidence

The JSON record retains both reports, source hashes, the original package-record
hash and passing execution logs. Its verifier reconstructs compiler models and
generated PHP/C sources, checks installed inventories and archive identities,
and rejects fifteen mutations that remove or contradict required observations.
The earlier package and conversion records remain intact.

The first shared-loading attempt passed composition and conflict checks but
failed because the test placed `strict_types` directly in PHP-Wasm's wrapped
`run()` source. The corrected caller includes a real PHP file. The retained
passing run covers weak and strict failure cases without relaxing validation.

The historical registration checker also now recognizes digits in test flags
such as `LEAN_BRIDGE_WASM32_RECURSIVE_TEST`. The verifier reconstructs the old
checker sources byte for byte before comparing their original hashes. Existing
receipts stay unchanged; appended shell commands and disabled test flags reject.

Run the [package, reproduction and shared-loading commands](../contributing/testing.md#recursive-php-wasm-packages)
in that order. CI requires both new reports and retains them as artifacts.
