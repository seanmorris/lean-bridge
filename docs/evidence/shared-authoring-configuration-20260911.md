# Shared author configuration acceptance, 11 September 2026

VO1238 implements the first source-configuration slice of VO1208. These checks use the working tree based on `e6e99d422396ed3d12bf376e7a2ee29cb1a13192`; the type inventory records exact source hashes. No commit, push, registry upload, or deployment was performed.

## Configuration and installed APIs

`lean-bridge.exports.json` selects modules and exact declarations for source analysis and ordinary npm/native builds. Its canonical identity and exact file hash enter the build inputs. The removed `lean-bridge.native.json` stops analysis and builds with field-by-field migration instructions. No compatibility parser remains.

The configuration tests cover schema parity, absent defaults, immutable records, malformed/oversized/symlinked files, cancellation, unknown modules and exports, non-callable selection, conflicting scopes, unchanged input files, ignored-choice prevention, and reviewed-IR conflicts. A final review found a validation-to-analysis race. The new regression first reproduced the accepted stale settings, then passed after analysis, npm planning, and native compilation adopted one snapshot check. Configuration changes, additions, and removals now fail before planning proceeds.

The npm integration builds an ordinary project selecting only `OnboardingSmall.add`, installs the resulting runtime and component archives, calls `add(100n, 23n)`, and checks that the unselected `isEmpty` is absent. The unchanged tutorial also installs and prints `123n`, `true`, `false`. Local receipt and CLI verification pass.

The native integration builds an unrelated source fixture with one selected function. It checks the CPAN module `LeanBridge::Selected`, package version `0.007`, and the single compiled export `First.bump`, installs the archives, and receives `42` from `bump(41)`. This check passes on all four Perl ABI configurations.

```sh
node --test tests/export-configuration.test.mjs tests/perl-contract.test.mjs tests/lean-project-analyzer.test.mjs
node --test tests/component-npm-package.test.mjs
LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 node scripts/test-perl-consumers.mjs
```

The schema check also found a pre-existing mismatch: source analysis emitted `resultMode`, `effects`, and `leanEffect` fields that its published JSON schema rejected. The schema now accepts those existing fields, and actual configured analysis output passes validation.

## Perl type and lifecycle regression

Perl 5.36.3 and 5.38.2, each threaded and nonthreaded, pass all three native test groups: configured project installation, the Workshop/Other installed suite, and fresh-elaboration rejection cases. Workshop/Other runs 183 API checks per ABI, with the two thread-only checks skipped on unthreaded interpreters. The host development matrix declares glibc 2.36 explicitly.

The unchanged fixtures exercise all sixteen scalars across the recorded positions, copied containers, resources, synchronous callbacks, returned closures, exceptions, disposal, cross-component identity, prebuilt-only installation, XS-only fallback, corrupt files, and incompatible runtime/ABI rejection. Independently compiled native outputs and repeated package assembly compare equal in each ABI run.

The compiled Workshop library remains byte-identical to the earlier implementation: SHA-256 `c7c0bf719bb6c7816a0bad4157e72dad738349f82a17037a854c2bf0ebd04bed`. Source and package metadata changed to record shared configuration. Runtime identity remains `8a394bdc579b6d4c7cc7da9f4e723aa05fd07cc739c4eaa14039264cb78583bd`.

## Production-floor installation

A separate native build prepares all four XS variants in one release. The compiler-free platform helper raises its deployment floor from glibc 2.36 to 2.38 without changing native/XS bytes or weakening installation checks. It preserves all other payload hashes; archive assembly rejects drift.

`scripts/check-perl-prepared-install.mjs` installs those exact archives in an `emscripten/emsdk:6.0.6` container running glibc 2.39. All four Perls pass both `prebuilt-only` and `build-xs`: eight installations, each passing 173 Workshop checks and the unchanged documentation example (`42`, `42`, `42`, `41`). No Lean compiler or Lean runtime build is involved in those installations.

| Four-ABI production archive | SHA-256 |
| --- | --- |
| `LeanBridge-Runtime-0.001.tar.gz` | `cc5e66b72119f02388f9daab902b76cd1467f3c3f8740e987aa5add4f356a582` |
| `LeanBridge-Workshop-0.001.tar.gz` | `8165c59e43829f766b04c7db561598fe6330926950de4f314035f691ad38cb88` |

The runtime archive also matches the earlier production archive. A second independent four-ABI build and platform packaging run produce byte-identical archives and release metadata. This work does not change the runtime implementation or the ABI.

## Repository and documentation checks

`npm run check:core` passes lint, checked JavaScript types, and 433 contract tests. `npm run site:test` passes 101 tests, and `npm run site:typecheck` passes. The generated reference check covers 16 pages. The installed scalar boundary integration also passes.

The rebuilt site contains 79 documentation pages and 94 React routes. `site/docs-browser-check.mjs` and `site/search-browser-check.mjs` pass against separately assembled `/` and `/lean-bridge/` sites in Chromium. The checks cover all guides at three viewport widths, no-JavaScript rendering, grouped pagination, historical bookmarks, language search, and both user workflows.

The CLI package allowlist and both Nix source-closure manifests pass their contract checks. Nix is unavailable on this host, so this run does not claim execution of the Nix engine builds.

## Remaining stages

No new type/profile cells are claimed. This refresh preserves the previous position-specific acceptance and its limitations. The shared source elaborator, locked external dependencies, additional ordinary-source targets, richer configuration decisions, and the remaining type families stay open under [the staged plan](../architecture/cross-language-authoring.md).

The general author guides now cover every consumer language and link its package and conversion reference. This documentation coverage does not mark unfinished compiler or package integrations as implemented.
