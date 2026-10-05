# Native PHP package bootstrap

The owned PHP package generator adds automatic lazy loading to the
[public-call implementation](owned-php-calls-20260928.md). Requiring `src/Api.php`
configures its private loader. Invalid inputs reject before native loading.
Calling valid functions from an uncompiled source-only package reports that a
compiled release is required.

The generated manifest records public exports, aliases, every generated source
hash and the ownership contract. Package source audits reconstruct every file
and reject missing, added or changed files, including changes accompanied by
updated hashes. Native evidence must identify the component, compiled receipt,
shared runtime, adapter, Lean component library and private GMP dependency.
Non-string digests and incomplete or mismatched inventories reject.

## Shared and private libraries

The existing shared PHP loader remains byte-for-byte unchanged. It authenticates
all native files, checks process and runtime compatibility, and pins the shared
Lean libraries and compiled Lean component. The owned loader then maps private
GMP and its adapter with local, deep-bound, non-unloadable mappings. Compatible
owned packages reuse those mappings. Conflicting private-library hashes reject
before another native library loads.

This separates the public C adapter's GMP symbols from Lean's symbols while
allowing copied and owned PHP packages to use the same Lean runtime. The adapter
builder must link its isolated GMP dependency before Lean. The package loader
does not establish that build fact by itself.

## Executed checks

Four tests pass with native execution enabled:

- Deterministic package generation and complete source audits.
- Rejection of malformed native identities and ownership-contract changes.
- Automatic bootstrap and cold validation with PHP FFI disabled.
- Loader isolation in both copied-first and owned-first package orders.

The loader test compiles small shared libraries that deliberately export the
same symbol with different results. In each load order, the private adapter
receives 97 while the copied adapter receives 11. Both processes also reject
changed library inventories, conflicting private hashes and incompatible runtime
identities, then confirm that the accepted libraries still work.

These are symbol-resolution fixtures, not a compiled Lean or GMP package. The
public-call evidence covers actual Lean execution separately. The nine existing
recursive PHP contract tests also pass, including their complete-package byte
comparisons against frozen copied and acyclic packages.

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-php-package.test.mjs
node --test tests/php-recursive-callable-contract.test.mjs
```

## Remaining delivery work

The owned native adapter builder, private GMP artifact verification, Composer
archive assembly and installation, cross-package execution with real Lean,
reproducibility checks and CLI admission remain open. This milestone does not
admit prepared packages or change support-table cells.
