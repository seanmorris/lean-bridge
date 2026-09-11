# npm author configuration acceptance, 11 September 2026

This VO1238 follow-up starts from local commit `69079cd`. It implements `targets.npm.name` and `targets.npm.version` in the shared author configuration. It does not add supported types or complete the cross-language authoring plan.

## Package identity and sealed input

Build planning validates optional npm settings before compilation. Module/export selection still controls the Lean API. The compiler-free npm packager reads the configuration from the verified bundle's source snapshot and checks its exact hash. It includes the configuration in package metadata. It never reopens the original project to choose a package name.

The installed fixture selects `OnboardingSmall.add` and prepares `@example/_math@2.3.4-beta.1`. Its Lean identity remains `onboarding-small@1.0.0`. After building the bundle, the test removes the temporary source project, packages twice, compares receipts and archive hashes, installs both dependencies, calls `add(100n, 23n)`, and confirms that `isEmpty` is absent. Node prints `123` and `false`.

The default tutorial remains `onboarding-small@1.0.0`; installed calls print `123n`, `true`, and `false`. Repeated package assembly remains byte-identical. Both paths load the shared runtime automatically.

A separate configured build uses the unscoped name `lean-bridge-runtime` and the runtime's exact version. The packager gives that component a distinct archive filename, so it cannot overwrite the runtime archive. Receipt verification passes and the shared runtime archive remains byte-identical.

## Receipts and publication

Version-one local receipts retain their requirement that the package coordinate equal the compiled component identity. A differing npm coordinate produces a version-two receipt with the same closed fields and distinct component/package identities. The copied standalone verifier and the installed Node-only CLI accept both versions. Signed release receipts keep their existing format.

The publication test builds two independent copies of an ordinary source project, authorizes `@example/verified-math@2.3.4-beta.1`, signs the transaction with a temporary test key, and uses an in-memory registry adapter. The manifest, signed receipt, and adapter agree on the configured npm coordinate; authorization retains the Lean component identity. Resuming performs no second upload.

An adversarial test substitutes a different receipt coordinate and recomputes the unsigned inventory and report hashes. Publication rejects it because it disagrees with the bundled author configuration. Other tests reject modified bundles, unlisted configuration files, unsupported choices, malformed coordinates, unsafe archive paths, ranges, invalid prereleases, oversized versions, and the reserved runtime name.

The npm version validator rejects `+build` metadata. The installed npm publisher normalizes versions with `semver.clean` before indexing a release, which removes that metadata. Rejecting it avoids planning one coordinate and publishing another.

## Regression checks

The focused configuration, installed npm, receipt, and publication run passes 44 tests. The documentation's npm configuration example is validated by the same reader and coordinate resolver used by builds. CLI archive and Nix source-closure checks include the shared validator and the new receipt schema.

Perl 5.38.2-threaded passes all three native test groups, including the 183-check installed API suite, selected-export installation, prebuilt and XS-only paths, and fresh-elaboration rejection cases. This follow-up does not change native compilation, generated XS, CPAN packaging, or runtime code. The prior four-ABI and production-floor checks remain recorded in [shared configuration acceptance](shared-authoring-configuration-20260911.md); this follow-up reruns one ABI.

```sh
node --test tests/export-configuration.test.mjs tests/component-npm-package.test.mjs tests/component-publication.test.mjs tests/cli-verification.test.mjs
node --test tests/cli-npm-package.test.mjs tests/engine-execution-request.test.mjs tests/perl-contract.test.mjs tests/lean-author-documentation.test.mjs
node --test tests/lean-project-analyzer.test.mjs tests/component-scalars.test.mjs
LEAN_BRIDGE_PERL_NATIVE_TEST=1 LEAN_BRIDGE_TEST_PERL=/absolute/path/to/perl-5.38.2-threaded/bin/perl LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 node --test tests/perl-native.test.mjs
```

The glibc 2.36 setting applies only to this development-host test. Production deployment requirements remain unchanged. No registry upload, push, or deployment was performed.

## Repository and site

`npm run check:core` passes lint, checked JavaScript types, and 436 contract tests. `npm run site:test` passes 101 tests; site typechecking and all 16 generated reference checks pass. The rebuilt `/lean-bridge/` artifact contains 79 documentation pages and 94 React routes.

The three changed guides render in Chromium at 390, 768, and 1440 pixels, with one site header, no page overflow, and no JavaScript requirement for their text. The new link from the existing-library guide reaches the npm settings heading. The browser check waits for the destination article after the URL changes, because React navigation updates the URL before mounting the article. No site code changed for this check.

Both Nix source-closure checks pass. Nix is unavailable on this host, so this follow-up does not claim a Nix engine build.

## Remaining work

VO1238 remains open for specialization, ownership, refinement, and effect configuration contracts. Locked Lake dependencies, the authoritative elaborator, additional source targets, and generic package-set receipts remain separate stages. No type/profile cells are promoted by this package-metadata change.
