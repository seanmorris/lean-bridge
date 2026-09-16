# Immutable CPAN runtime coordinates, 2026-09-16

VO1240 replaces CPAN's fixed shared-runtime version with a version derived from its complete prepared payload. This follows the package-license milestone `fb4d9ab`.

## Coordinate and dependency policy

The runtime coordinate hashes every prepared file and the payload manifest. Only the derived module, metadata and manifest version fields are normalized; their final values must agree. The file inventory and package identity are derived separately to avoid self-reference. The basis includes selected prebuilt ABI records, XS binaries and compilation receipts, native libraries and headers, Perl sources, the installation helper, platform floor, metadata, and license notices.

The packing record binds the deterministic archive implementation, fixed timestamp, and Node/zlib/ICU versions. Assembly verifies the exact recorded file set and hashes, recomputes the runtime coordinate, checks the packing environment, and archives the verified byte snapshots. Re-sealing changed file hashes cannot retain an old runtime version. Different archive timestamps are rejected.

The version is `0.002` followed by the SHA-256 identity encoded as 78 decimal digits and a final `1`. All 256 bits are retained. The fixed width and nonzero terminator prevent leading/trailing-zero ambiguities in version comparison. Perl modules and JSON metadata keep the value as a string. Component versions retain the existing author-selected decimal format.

The builder finishes all selected runtime ABIs before preparing any component. Each component pins the completed runtime with `==` in both configure and runtime prerequisites. `MYMETA.json` preserves these requirements. Configuration, component XS compilation and module loading require exact version equality in addition to the existing native/binding compatibility checks. Unrelated libraries can share an unchanged completed runtime. XS-only consumer installation retains the original distribution version and never rebuilds Lean.

The platform-floor acceptance helper verifies its input packages before making changes. It derives a new runtime coordinate and updates the component's pin without modifying compiled binaries.

## Package-manager semantics

CPAN accepts string-valued decimal versions and exact prerequisite ranges. Its main index requires non-decreasing module versions, while content-derived values have no chronological order. Publishers must retain and identify the exact runtime archive for each component. The publishing and consumer guides cover exact archive installation; they do not assume a latest-only mirror can resolve every pin. [CPAN metadata specification](https://metacpan.org/pod/CPAN::Meta::Spec), [PAUSE indexing rules](https://pause.perl.org/pause/query?ACTION=pause_operating_model), [cpanm version selection](https://metacpan.org/pod/cpanm)

## Acceptance

- The 44 Perl contract checks pass. Coordinate regressions cover helper, notice, metadata, native-library, platform-floor, packer and prebuilt-selection changes, repeated preparation, timestamp rejection, stale re-sealed inventories and idempotent finalization. Read-only Nix-style templates remain unchanged.
- A runtime containing threaded and nonthreaded Perl 5.36.3 and 5.38.2 reproduces byte-identical runtime and component archives with the interpreter order reversed. Each interpreter installs the same archives and calls the generated Sample API. The platform-floor helper changes the runtime version and component pin while preserving every compiled binary hash. This check passed in 188.0 seconds.
- The installed Workshop suite passes all 183 consumer assertions through prebuilt and XS-only routes, including compiler-denied prebuilt installation, source-independent calls, callbacks, resources and invalid inputs. Additional checks verify `META.json`/`MYMETA.json` exact prerequisites, lossless parsing by `CPAN::Meta::Requirements` and `Module::Metadata`, and load/configuration rejection of higher and lower versions. Two unrelated components share the completed runtime. This run passed in 178.4 seconds.
- Telemetry's relocated combined npm/CPAN build reproduces all four archives, installs and calls both APIs after source removal, and verifies copied package-set receipts with Node alone. Separate npm-only and CPAN-only selections also pass. This is a focused mixed-profile regression, not a fresh run of all eleven targets.
- Core checks pass 697 tests with 52 gated skips. Documentation passes 65 checks, CLI archive installation five, and site/demo tests 111. Lint, checked JavaScript, the type inventory, all 16 generated reference pages, site typechecking and production site generation pass.

Local native checks use the explicit glibc 2.36 test override. The production profile retains 2.38. Mixed-profile tests use real compilers through the existing injected Nix command transport; Nix itself is not installed locally. Type coverage remains 656 installed-tested cells. Seven Perl evidence hashes were refreshed for packaging and acceptance changes, without promoting type-support claims.

CI on `61b0e71` exposed a test-fixture permissions error: the helper and notice corruption cases tried to overwrite mode-0444 copies. Root's permission bypass hid the error locally. Running the contract as `nobody` reproduced both failures. The corruption helper now makes only its disposable copy writable; the source templates remain unchanged. All 44 Perl contract checks pass as `nobody`, and the nine coordinate checks also pass as root. No package implementation changed in this correction.

## Remaining work

No registry publication occurred. npm and PHP-Wasm retain their existing content-derived runtime versions, but their identities do not explicitly bind host Node/zlib/ICU versions. That cross-host archive-coordinate policy needs the next audit. Registry recipe rehearsal and signed Nix publication/consumption review also remain in VO1240; the broader type-corpus work follows in VO1217.
