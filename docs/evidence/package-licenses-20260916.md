# Shared package licenses, 2026-09-16

VO1240's license milestone builds on `496b185`. Ordinary-source packages now accept `package.license` and `package.licenseFiles` in `lean-bridge.exports.json`. Names, versions and existing publisher metadata keep their previous meanings.

## Source declarations and retained terms

The license parser runs offline against 695 nondeprecated license identifiers and 83 exceptions from SPDX License List 3.28.0. It implements `AND`, `OR`, `WITH`, `+` and grouping with explicit size and nesting limits. The retained identifier table records the upstream commit and SHA-256 of both source JSON files. License references and deprecated identifiers are rejected explicitly; no runtime npm dependency or network lookup was added.

Custom filenames join the existing conventional notice discovery. Analysis rejects missing, blank, hidden, excluded, symlinked or unsafe paths. Native and PHP-Wasm source-notice inventory version two retains each root or dependency package's exact configuration bytes, bound to its captured input hash. Readers check the complete selected notice set and payload bytes after relocation. Version-one conventional inventories remain readable.

Ordinary npm uses the shared expression when present and retains the original `package.json` fallback otherwise. Conflicting declarations fail analysis. Custom root filenames are copied under `notices/source/` unless they are conventional root notice names; this avoids overwriting generated files. Dependencies' declared terms are copied under `notices/lake/`. Signed publication verifies declarations and complete notice inventories against captured source bytes, including nonempty declared terms.

## Package projections

npm, Composer and Cargo receive the expression in `license`; NuGet uses an expression license. Maven retains the whole expression in one license name. Python wheels use core metadata 2.4 with `License-Expression` and `License-File` entries. C, C++ and WIT/WASI retain the complete neutral declaration.

RubyGems and CPAN cannot express arbitrary Boolean license terms in their standard fields. Ruby keeps a single admitted term where possible, otherwise `Nonstandard`, and retains the exact expression in `metadata.spdx_expression`. CPAN uses an exact vocabulary mapping or `unknown`, with the expression in `x_spdx_expression`. MakeMaker preserves that extra field in `MYMETA.json`. Shared runtime packages do not inherit the component's terms.

## Executed checks

- Seventeen focused metadata and source-notice checks cover expression syntax and precedence, schema agreement, path safety, empty/missing files, symlinks, source drift, altered dependency declarations, omitted terms and version-one readers.
- Two npm package tests pass, including assembly after source deletion, exact repeated archives, installed public calls, and a custom root `TERMS.txt` retained under `notices/source/`.
- All 19 signed-publication cases pass. The new case publishes through the local test adapter using only the shared license declaration and a custom terms filename. No external registry is contacted.
- Shop reproduces 14 archives across 11 targets and executes installed public APIs after hiding both source trees. Native parsers inspect the expression and publisher fields in every archive. Root and local dependency custom terms retain their exact bytes. This run completed in 528.6 seconds.
- All four selections combining npm, native PHP and PHP-Wasm pass in 371.8 seconds, including relocated offline consumers and package-set verification. The API identity remains `73e9e4629ce4fb494dd34fddfc12c4f933bc555fc604db4068ffec79a94fb298`. An additional direct archive inspection confirms the custom terms are present in the component formats and absent from shared runtimes.
- A real CPAN configuration run verifies `MYMETA.json` contains `x_spdx_expression: MIT OR Apache-2.0`, the standard `unknown` value and the declared authors. A wheel inspection resolves all ten `License-File` entries to files in its `.dist-info/licenses/` directory.
- The installed CLI's five archive checks pass, including dependency-free Node-only use with the pinned identifier data. Lint and checked JavaScript pass.

Telemetry also reproduces its npm/CPAN packages, executes both installed APIs and verifies relocated package sets with its independent `MIT` declaration (140.7 seconds). The complete mixed-profile suite passes nine tests in 669.8 seconds.

Final core checks pass 689 tests with 52 gated skips. Documentation passes 65 checks, site/demo tests 111, and site typechecking and the production site build pass. All 16 reference pages regenerate. The source-evidence hashes are refreshed for the license, package and fixture changes; type coverage remains 656 installed-tested cells with no promotions.

The local mixed-profile harness uses real Lean and downstream compilers through injected Nix command transport. Nix itself is not installed here. The native test floor is glibc 2.36; production remains 2.38. License metadata changes no conversion implementation or type-support claim.

## Remaining VO1240 work

Immutable shared-runtime coordinates, CPAN runtime dependency/version policy, and the remaining publication recipes and signed Nix audit remain open. This milestone performs no registry upload, production-branch push, GitHub release or Pages publication. Author-declared expressions are not a legal compatibility analysis; registry-specific admission can also use an older SPDX list.
