# Native PHP family regressions on current graph-enabled sources

The [execution record](php-current-family-regressions-20260924.json) contains six
fresh installed gates for aliases, primitive callables, collections, compounds,
Lists and variants. All six passed without skips in 954.379 seconds.

Each family runs ordinary Lean source and independently reviewed IR through
offline Composer installation, then executes weak and strict PHP callers after
removing producer sources. The four runs per family check 1,706,104 public
assertions in total. Conversion-failure probes and variant sanitizer checks
retain their original expectations.

The record binds 89 execution-source files, complete package and deployment
inventories, the compiler-free consumer programs and all failure observations.
The verifier compares the public results and failure checks with the unchanged
historical family receipts. It reconstructs the earlier expanded and current
named reviewed compound inputs separately.

The older archives predate runtime-broker, allocation-guard and provenance
changes. Their hashes remain in their original receipts. This record stores the
new archives and verifies their package receipts, installed files and loaded
libraries. It does not claim byte-for-byte reproduction of those older archives.
The older callable receipt summarized some installed files; this record retains
the complete fresh inventory.

Run the installed gates with:

```sh
LEAN_BRIDGE_PHP_ALIAS_TEST=1 \
LEAN_BRIDGE_PHP_CALLABLE_TEST=1 \
LEAN_BRIDGE_PHP_COLLECTION_TEST=1 \
LEAN_BRIDGE_PHP_COMPOUND_TEST=1 \
LEAN_BRIDGE_PHP_LIST_TEST=1 \
LEAN_BRIDGE_PHP_VARIANT_TEST=1 \
  node --test --test-concurrency=1 \
  tests/php-aliases.test.mjs tests/php-callables.test.mjs \
  tests/php-collections.test.mjs tests/php-compounds.test.mjs \
  tests/php-lists.test.mjs tests/php-variants.test.mjs
```

`tests/current-source-evidence.test.mjs` checks the recorded executions and
rejects missing modes, weakened public or failure checks, altered caller sources,
inconsistent archive identities and skipped gates. These regressions preserve
existing families; structured callback payloads and resource-containing copies
remain separate work under VO1219.
