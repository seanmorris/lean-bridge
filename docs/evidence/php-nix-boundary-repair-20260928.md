# Include native PHP imports in the filtered Perl builder

VO task 1219. The native PHP integration added imports to the shared native
builder. The Nix Perl source filter omitted 15 modules reached by those
imports, so the filtered builder could not start.

Two existing Perl contract tests reproduced the problem. The import-closure
check reported `owned-php-projection.mjs` missing from the filter. Loading the
copied engine with no checkout modules available failed to find
`src/backends/php/owned-package.mjs`.

The repair adds the 12 owned PHP backend modules, both owned PHP build
modules, and `src/release/owned-composer.mjs` to
`nix/perl-engine-source-boundary.json`. It preserves every existing entry.
The core and component-engine filters do not import the native builder and
do not need these additions.

## Verification

```sh
node --test --test-name-pattern='Nix Perl source boundary|filtered Perl engine loads' \
  tests/perl-contract.test.mjs
node --test tests/perl-contract.test.mjs
```

Both reproduced failures pass after the manifest repair. The full Perl
contract suite passes 48 tests with no skips. Its filtered-engine test copies
only declared source files, imports the native builder with an unavailable
`PATH`, then removes a required module and confirms that loading fails.

[The receipt](php-nix-boundary-repair-20260928.json) retains the failed and
passing logs, exact source identities, and the 15 added paths. A successor
history layer preserves the committed JVM, wasm32, PHP and Perl receipts
without changing their observations or archive identities. Type-table edits
refresh source hashes only; no support cells are promoted.

These checks cover the declared import closure and the isolated Node loader.
They do not claim a full Nix build or a new installed-consumer execution.
