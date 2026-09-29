# Repair owned WIT build regressions

VO task 1219. The production owned WIT integration exposed eight failures in
the full core suite at `2313a9d`.

Four tests still expected mixed npm/WIT and PHP-Wasm/WIT builds to reject
owned declarations. These combinations now reach their compilers. The tests
check the missing JavaScript SDK or native Lean executable instead, and
continue checking that failure leaves the project and output unchanged. The
native probe uses an unavailable `PATH` and requires the error to identify
`spawn lean`.

Four failures came from the filtered Perl build engine. Its source manifest
omitted 12 WIT modules imported by the shared native builder. The repair adds
the complete transitive import closure and preserves every existing entry.

## Verification

```sh
node --test --test-name-pattern='owned npm dispatch|ownership reaches|Nix Perl source boundary|filtered Perl engine loads|filtered Perl source closure|filtered Perl engine retains package-set' \
  tests/owned-javascript-cli.test.mjs tests/owned-php-wasm-cli.test.mjs \
  tests/perl-contract.test.mjs tests/php-nix-boundary-repair-evidence.test.mjs \
  tests/toolchain-preflight.test.mjs
node --test tests/perl-contract.test.mjs tests/owned-javascript-cli.test.mjs \
  tests/owned-php-wasm-cli.test.mjs tests/toolchain-preflight.test.mjs
```

All eight reproduced failures pass after the repair, with no skips. The
broader contract run passes 61 tests and skips the explicitly enabled
installed-CLI probe. Filtered-engine tests copy only declared files and load
the engine without checkout imports or compilers. Removing any of the 12
newly included modules fails the import-closure check.

[The receipt](wit-owned-build-repair-20260929.json) records the failed and
passing logs, the exact source identities, and the manifest delta. Earlier
WIT, PHP, Perl and other receipts retain their original bytes and observations.
The type-surface table refreshes source hashes only.

This repair does not record a new Nix build or installed-package acceptance.
The owned WIT packages retain their separate six-case
[installed acceptance receipt](wit-owned-packages-20260929.json).
