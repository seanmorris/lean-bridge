# Shared publisher metadata, 2026-09-16

VO1240 now carries a library's declared description, authors, homepage and repository into ordinary-source packages. Authors set `package` in `lean-bridge.exports.json`; target-specific names and versions remain under `targets`.

## Source binding and package formats

Native and PHP-Wasm compilation retains the exact configuration text in `sourceIdentity.exportConfigurationSource`. Before generating a package, the reader compares its byte length and SHA-256 with the captured source inventory, compares its canonical configuration hash with the compiler receipt, and validates the metadata. Packaging uses this retained declaration after the source tree is removed. npm retains the declaration in its sealed bundle and generated package provenance.

The signed npm publication validator also checks the declaration against captured source bytes. Recomputing outer unsigned inventories cannot substitute a changed declaration. A missing file is rejected too.

Package generation projects the declaration into npm, Python wheel, Cargo, NuGet, Maven, RubyGems, CPAN and Composer metadata. Both PHP-Wasm component formats receive the same declaration. C, C++ and WIT/WASI archives include a root `package-metadata.json`. Formats with fewer author fields retain the complete declaration in their compiled provenance. Shared runtimes keep their own metadata.

Validation bounds text and author counts, rejects unknown fields and control characters, and requires HTTPS URLs without credentials, queries or fragments. Formatters escape XML, Ruby, TOML and Python mailbox syntax. The test declarations contain quotes, backslashes, XML metacharacters and Ruby interpolation syntax; these remain data in the packaged manifests.

## Executed checks

- Shop reproduces 14 archives across npm, CPAN, C, C++, NuGet, Maven, RubyGems, WIT/WASI, PyPI, Cargo and native PHP. Independent archive reads verify the declared metadata, and installed public calls execute after both source trees are hidden.
- A second library, Telemetry, reproduces its npm/CPAN packages with its own declared authors and URLs and runs both installed APIs after relocation.
- Telemetry's PHP-Wasm test reproduces the three-profile release and checks all four selections combining JavaScript, native PHP and PHP-Wasm. npm and Composer install offline, and relocated applications execute without Lean or a C compiler. The source API identity remains `73e9e4629ce4fb494dd34fddfc12c4f933bc555fc604db4068ffec79a94fb298`.
- The npm selected-export test removes its original project before assembling two identical package sets, then installs and calls the selected function. It verifies the component's metadata and the runtime's separate ownership.
- Eighteen signed-publication cases pass, including changed and missing publisher declarations, notice corruption and license-declaration drift.
- A separate CPAN installation check reads the generated `MYMETA.json` and verifies the declared description, both authors, homepage and repository. The component license stays `unknown`.
- Unit checks cover schema agreement, unsupported target admission, bounded UTF-8 text, header injection, malformed URLs, duplicate authors, retained configuration hashes and resealed declaration changes.

Local mixed-profile checks use the real Lean and downstream compilers through the existing injected Nix command transport. Nix itself is not installed locally. Native tests use the explicit glibc 2.36 test override; the production floor stays 2.38. These changes affect packaging and provenance, not conversion implementations or supported type families.

Core checks pass 684 tests with 52 gated skips. Documentation passes 65 checks, CLI packaging five, and site/demo tests 111. Lint, checked JavaScript, the type inventory, all 16 generated reference pages, site typechecking and the production site build pass. Type coverage remains 656 installed-tested cells. Source hashes were refreshed for the metadata and provenance changes without promoting type-support claims.

## Remaining work

At this milestone, shared license-expression declarations and custom license-file paths remained unimplemented. The [license follow-up](package-licenses-20260916.md) adds them. Immutable shared-runtime coordinates, CPAN runtime-version resolution, and the remaining publication-recipe audit remain VO1240 work. No registry upload, production branch push, GitHub release or Pages publication was performed.
