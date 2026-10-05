# Native PHP callback-result acceptance

The frozen acceptance covers six native Composer package configurations:
ordinary source and reviewed IR, each with no host callbacks, host callbacks,
and the combined ownership profile. Each configuration used two independent
producer builds. The original and independent package handoffs contain the
same package-set receipt and Composer ZIP.

The installed consumers run from relocated, source-free directories with an
offline Composer cache. Weak and strict callers run against the installed and
second relocation. The six reports contain 24 public runs and 3,344 public
assertions. They also contain 180 cold and warm native-library replacement,
symlink, and missing-file checks. Every rejected asset is restored before a
successful public call.

The receipt also binds the earlier six direct native executions and their 640
assertions. It records 300 raw package execution slots. Twelve entries are
documented aliases of executions already counted in that total. Result-slot,
registered-state, and callback-broker counters return to zero after each public
call.

The reports do not expose a native allocation ledger. The receipt therefore
does not claim allocator-level leak detection, sanitizer execution, fork or
thread lifetime coverage, retained host callbacks, asynchronous delivery, or a
published registry package.

## Required checks

Build all six current package configurations:

```sh
LEAN_BRIDGE_PHP="$(command -v php)" \
LEAN_BRIDGE_COMPOSER="$(command -v composer)" \
npm run test:owned-php-callback-packages
```

Verify the immutable receipt, staged runtime record, source history, embedded
reports, terminal logs, and recorded handoff identities:

```sh
npm run test:owned-php-callback-evidence
```

The package-evidence suite additionally reads the retained original handoffs,
checks each ZIP header, CRC, path, file identity, package receipt, and installed
inventory, and rejects coordinated report and archive mutations:

```sh
npm run test:owned-php-callback-package-evidence
```

The evidence file is
[`owned-php-callback-results-20261003.json`](owned-php-callback-results-20261003.json).
Its `sources` object binds the acceptance checker and every imported source
used by the package and runtime observations. Its `sourceHistory` field points
to the closed staging transition. Its `previous` field preserves the completed
Perl callback-result acceptance.
