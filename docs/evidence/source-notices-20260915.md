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

## Remaining audit work

Project a library's declared authors, license expression, description and repository into each ecosystem's metadata. Audit package coordinates and compatible runtime/numeric dependency constraints. Exercise native publication recipes and signed Nix cache guidance. No registry upload, GitHub release, production branch push or Pages publication was performed for this milestone.
