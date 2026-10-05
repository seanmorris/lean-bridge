# Source-license retention across ordinary packages

VO1240 packaging audit, based on `2dd2df4`.

## Findings and changes

Ordinary native and PHP-Wasm packages included Lean and Lean Bridge licenses but omitted the compiled library's and its Lake dependencies' notices. CPAN declared every component MIT, attributed it to Lean Bridge and pointed at the bridge repository. Ordinary Cargo used Lean Bridge's license as the crate's `license-file`.

Compilation now captures a `source-notices.json` inventory and content-addressed notice files. Its digest is part of the compiled source identity. The reader checks the inventory, package origins, root and dependency notice completeness, filenames and payload hashes. Root input hashes must reproduce the compiled source-tree identity. Archive assembly reads these compiled inputs without reopening the source project or invoking Lean.

The capture retains conventional license, notice, copying and copyright filenames, including nested paths and case variants, and files in `LICENSES/` directories. Hidden files and directories are not notice candidates. It records missing notices as an empty list and deduplicates identical bytes without losing their original paths.

All native component formats and both PHP-Wasm component formats retain this inventory. Ordinary JavaScript npm packages now retain nested, case-insensitive and REUSE-style notices as well. Shared runtime packages remain independent of their consumers' source licenses.

CPAN component metadata now declares license `unknown`, leaves the author explicitly undeclared and omits the bridge repository URL. Its installer reads that verified metadata instead of restoring hardcoded MIT and bridge authorship in `MYMETA.json`. Cargo no longer points its license declaration at Lean Bridge's license. RubyGems and NuGet no longer substitute Lean Bridge or a package ID for the library's author. These changes do not provide author-supplied publisher metadata; that remains a separate VO1240 step.

## Executed checks

- Source-notice tests cover relocation, root/local/Git provenance, capture drift, symlinks, changed payloads, extra files, altered inventories, dependency omission and payload redirection.
- The Shop fixture reproduces 14 archives across npm, CPAN, C, C++, NuGet, Maven, RubyGems, WIT/WASI, PyPI, Cargo and native PHP. Each installed public API runs after hiding the source trees. Independent archive reads find the root and both dependency notices in every component, and none in the shared runtimes.
- Willow and Aspen each reproduce their PHP-Wasm npm and Composer packages through the offline-installed CLI. All 88 exports execute in Node and Chromium, including startup, first-call and mixed loading. The archive checks find each library's notice only in its component packages.
- Telemetry reproduces its npm/CPAN release, and all four npm/native-PHP/PHP-Wasm target selections compile and execute. The shared API identity remains `73e9e4629ce4fb494dd34fddfc12c4f933bc555fc604db4068ffec79a94fb298`.
- The Perl consumer suite passes 183 assertions through prebuilt and XS-only installation. A separate configuration check verifies the component's generated `MYMETA.json` license and author fields.

The core contract suite passes 678 checks, with 52 explicitly gated skips. Documentation checks pass 64/64 and CLI packaging passes 5/5. Lint, checked JavaScript, type-inventory validation, generated references, site typechecking, site/demo tests and the production site build pass. Type coverage remains 656 installed-tested cells; this milestone does not promote any type claims.

The mixed-source tests use real Lean compilation through the existing injected Nix-command transport. Nix itself is not installed locally. Native checks use the explicit glibc 2.36 test override; the production floor remains 2.38. These changes affect packaging and provenance, not supported type families or conversion semantics.

## Signed npm publication follow-up, 2026-09-16

[Downstream run 35028525911](https://github.com/seanmorris/lean-bridge/actions/runs/35028525911) failed after the notice-retention milestone. Packaging retained nested notices, but the publication validator still accepted only root-level uppercase `LICENSE`, `NOTICE` and `COPYING` filenames. The locked Lake publication test reproduced `Component notice differs from the SBOM` locally.

Publication now uses the shared safe notice classifier. It compares the complete SBOM notice list to captured source inputs and checks each file's existence, length and hash, including empty notices. The license declaration must match the captured `package.json` bytes. A nonempty `LICENSE`, `LICENCE`, `COPYING` or license file under `LICENSES/` is required. Attribution alone does not count, including `LICENSES/NOTICE`.

The signed publication suite covers nested lowercase license names, COPYING and REUSE layouts, exact packaged bytes, missing or blank declarations, empty terms, and attribution-only projects. Resealed-evidence tests reject omitted, duplicated, redirected and changed notices, a missing empty file, substituted declarations and changed source bytes. The downstream Node job now runs this suite through its pinned Nix engine. Local execution injects only the Nix command transport and uses real source capture, elaboration, compilation, linking and package verification.

The follow-up passes 16 signed-publication cases and eight notice unit tests. Generated-import Shop and Telemetry releases reproduce and run after offline installation. Both generated-import and generated-entry publication dry runs reproduce their archives and verify their manifests. The locked and dependency-free suites cover 23 and 28 executed cases respectively; two engine-identity comparisons required reruns because the initial runs overlapped a source edit. The root-only unwritable-directory test remains explicitly skipped.

Final core checks pass 679 tests with 52 gated skips. Documentation passes 64 checks, CLI packaging five, and site/demo tests 111. Lint, checked JavaScript, the type inventory, all 16 generated reference pages, site typechecking and the production site build pass. Type coverage remains unchanged. Compiler-library hashing made the generated publication checks take about eight and a half minutes each when run concurrently; that performance work is logged separately in VO1240.

## Remaining audit work

Project a library's declared authors, license expression, description and repository into each ecosystem's metadata. Audit package coordinates and compatible runtime/numeric dependency constraints. Exercise native publication recipes and signed Nix cache guidance. No registry upload, GitHub release, production branch push or Pages publication was performed for this milestone.
