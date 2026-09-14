# Choose targets and package formats

Select the languages your library will serve, then follow each target's build and publication guide. Publishing is the final stage of the [author workflow](lean-author-guide.md).

## Choose the package ecosystem

| Target language | Package manager and guide | Required build input |
| --- | --- | --- |
| JavaScript, TypeScript, browser, React, workers | [npm](publish/npm.md) | An ordinary Lake project with supported pure primitive exports; CLI target `npm`. |
| Python | [pip / PyPI](publish/pypi.md) | A prepared native bundle and reviewed Python binding metadata. |
| Rust | [Cargo](publish/cargo.md) | A prepared native bundle and reviewed Rust binding metadata. |
| C | [C package and CMake integration](publish/c.md) | An ordinary Lake project with pure copied primitive exports; CLI target `c`. Reviewed Alpha inputs remain supported. |
| C++ | [C++ package and CMake integration](publish/cpp.md) | The same ordinary native source profile; CLI target `cpp`. Reviewed Alpha inputs remain supported. |
| C# / .NET | [NuGet](publish/nuget.md) | A prepared bundle and managed binding inputs. |
| Java and Kotlin | [Maven](publish/maven.md) | A prepared bundle and shared JVM binding inputs. |
| Ruby | [RubyGems](publish/rubygems.md) | A prepared bundle and Ruby binding inputs. |
| Perl | [CPAN](publish/cpan.md) | An ordinary Lean project plus shared export configuration; CLI target `cpan` (alias `perl`). |
| PHP, native or Wasm | [Composer / Packagist and npm](publish/php.md) | A target-specific PHP package manifest and native or PHP-Wasm compiler inputs. |
| WIT / WASI | [Component and archive distribution](publish/wit-wasi.md) | A prepared bundle containing the executable adapter and native host. |

Ordinary source builds and package projections are different stages. The Alpha recipes for Python, Rust, C, C++, managed runtimes, PHP, and WASI use this repository's target-specific inputs. They do not make every Lake project buildable for those languages. Each target guide names its current inputs and checks.

For npm, CPAN, C and C++, repeat `--target` to build from one captured source tree. Lean compiles once per required profile: native for CPAN/C/C++, Wasm for npm. Every selected target must succeed before the release directory appears. Keep package settings in the same [source export configuration](lean/existing-package.md#configure-exports). The [implementation stages](architecture/cross-language-authoring.md#stages) cover the remaining source adapters.

## Build and approve the same artifacts

Check the library's proofs and application API, build into a new output directory, and install the generated package in a separate application. Preserve the source revision, package name and version, exact archive hashes, runtime dependencies, and consumer results.

Choose package coordinates and destinations you control before creating the candidate. Alpha and Workshop names identify examples, not namespaces you may publish as your own. Do not rename or edit an approved archive to change its identity.

The npm [local handoff](publish/local-handoff.md) reproduces the source build and writes archives plus a receipt. The [Perl guide](publish/cpan.md) documents its native build, two-build comparison, ABI matrix, and CPAN archives. Repository fixture builds and the universal reproducibility gate belong to [Contributing](contributing/testing.md).

## Choose the delivery path

| Delivery | Procedure |
| --- | --- |
| Installable files shared with another developer | [Local npm handoff](publish/local-handoff.md), or the selected target's archive instructions. |
| Package-manager registry | Use the target-language guide above for ownership, credentials, uploads, download verification, and recovery. |
| Release page or HTTPS artifact server | [Distribute release archives](publish/archives.md). |
| Signed binary cache | [Publish signed Nix packages](publish/nix.md). Consumers use [cache verification and substitution](consume/receive-package.md#install-from-a-signed-nix-cache). |

Your release owner approves the package coordinate, endpoint, credentials, signer policy where applicable, and exact bytes. Publishing an ordinary library does not require Lean Bridge's internal deployment-profile approvals.

An npm component can use the CLI's signed transaction. Other guides also document operator-run uploads with the ecosystem's own tools. Such an upload does not produce Lean Bridge's signed transaction or completion receipt. Keep its registry response and downloaded-package checks.

After publication, download the released bytes and run the matching [consumer example](consume.md). An uncertain upload needs inspection before retrying. Changed bytes require a new candidate and version.

## Know which record you have

| Record | What it establishes |
| --- | --- |
| `component-package-receipt.json` | An unsigned npm handoff inventory binding component and runtime archives to their hashes. |
| Component `publish-manifest.json` | A version-two publication plan binding the reproduced component, runtime dependency, destination, and signer policy. |
| Native C/C++/Perl `native-release.json` and archive receipts | Native runtime, component, Binding IR, and archive identities. These are not universal signed transaction receipts. |
| Universal `release-authorization.json` and `publish-manifest.json` | Lean Bridge's own reproduced candidate and ordered target selection. |
| `registry-transaction.json` | Preflight, writes, and partial progress for a configured transaction. |
| `release-receipt.json` | A signed completed transaction binding package coordinates and archive identities. |
| Nix cache signatures | Store metadata and the downloaded closure, verified against a trusted cache key. |
| Site `build-identity.json` | The documentation artifact's revision and file inventory, separate from package publication. |

Use [prepared-release verification](consume/receive-package.md) for the record actually supplied with a package.

## Current publication prerequisites

Only npm has an installed adapter for the shared registry transaction. Ordinary npm authors configure their registry and signing authority through [the npm guide](publish/npm.md#publish-an-ordinary-component); the runtime must already exist at its exact registry identity. Native Perl builds CPAN archives for operator upload to PAUSE.

The universal project gate recognizes `npm`, `pypi`, `cargo`, `nuget`, `maven`, and `rubygems` as registry targets. Its `c`, `cpp`, and `wit-wasi` targets retain archives. It has no universal `composer`, `php-native`, `php-wasm`, `cpan`, `perl`, or `nix` target.

[Lean Bridge release rehearsal](contributing/sandbox-release.md), [project production approval](contributing/production-release.md), [release-pipeline internals](../src/release/README.md), and [site deployment](contributing/github-pages.md) belong to Contributing. They maintain and release the bridge itself.
