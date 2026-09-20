# Choose targets and package formats

Select the languages your library will serve, then follow each target's build and publication guide. Publishing is the final stage of the [author workflow](lean-author-guide.md).

## Choose the package ecosystem

| Target language | Package manager and guide | Required build input |
| --- | --- | --- |
| JavaScript, TypeScript, browser, React, workers | [npm](publish/npm.md) | An ordinary Lake project with supported pure copied exports or synchronous primitive callables; CLI target `npm`. |
| Python | [pip / PyPI](publish/pypi.md) | An ordinary Lake project with pure copied primitives, arrays and acyclic records; CLI target `pypi`. |
| Rust | [Cargo](publish/cargo.md) | An ordinary Lake project with pure copied primitives, arrays and acyclic records; CLI target `cargo`. |
| C | [C package and CMake integration](publish/c.md) | An ordinary Lake project with pure copied primitive, array or record exports; CLI target `c`. Reviewed Alpha inputs remain supported. |
| C++ | [C++ package and CMake integration](publish/cpp.md) | The same ordinary native source profile; CLI target `cpp`. Reviewed Alpha inputs remain supported. |
| C# / .NET | [NuGet](publish/nuget.md) | An ordinary Lake project with copied primitives, arrays, acyclic records, options, results, products and synchronous primitive callables; CLI target `nuget`. |
| Java and Kotlin | [Maven](publish/maven.md) | An ordinary Lake project with copied primitives, arrays, acyclic records and synchronous primitive callables; CLI target `maven`. |
| Ruby | [RubyGems](publish/rubygems.md) | An ordinary Lake project with pure copied primitives, arrays and acyclic records; CLI target `rubygems`. |
| Perl | [CPAN](publish/cpan.md) | An ordinary Lean project plus shared export configuration; CLI target `cpan` (alias `perl`). |
| PHP, native or Wasm | [Composer / Packagist and npm](publish/php.md) | An ordinary Lake project with copied primitives, arrays, acyclic records and synchronous primitive callables; CLI target `php-native` or `php-wasm`. PHP-Wasm uses its own compiler inputs and npm/Composer coordinates. Alpha recipes retain separate manifests. |
| WIT / WASI | [Component and archive distribution](publish/wit-wasi.md) | An ordinary Lake project with pure copied primitives, arrays and acyclic records; CLI target `wit-wasi`. |

Options, results and nested binary products can target npm, C, C++, Python, Rust and C#. See the [conversion tables](reference/types.md) for each language's mappings and tested positions. npm copied containers and primitive callables currently require separate components.

Ordinary source builds and package projections are different stages. The Alpha recipes for Python, Rust, C, C++, managed runtimes, PHP, and WASI use this repository's target-specific inputs. They do not make every Lake project buildable for those languages. Each target guide names its current inputs and checks.

Repeat `--target` to build from one captured source tree. Lean compiles once per required ABI: native for CPAN/C/C++/NuGet/Maven/RubyGems/WIT/PyPI/Cargo/native PHP, JavaScript-Wasm for npm, and separately for PHP-Wasm. Every selected target must admit the API and succeed before the release directory appears. Keep package settings in the same [source export configuration](lean/existing-package.md#configure-exports).

## Declare package metadata

Set `package` once in the source project's `lean-bridge.exports.json`. It applies to every selected ordinary-source target; names and versions stay under `targets`.

```json
{
  "schemaVersion": 1,
  "package": {
    "description": "Checked inventory and pricing calculations.",
    "authors": [
      { "name": "Your library team", "email": "packages@example.org", "url": "https://example.org/team" }
    ],
    "homepage": "https://example.org/library",
    "repository": "https://github.com/your-org/your-library",
    "license": "MIT OR Apache-2.0",
    "licenseFiles": ["legal/mit-terms.txt", "legal/apache-terms.txt"]
  },
  "targets": {
    "npm": { "name": "@your-org/your-library", "version": "1.0.0" },
    "pypi": { "name": "your-library", "version": "1.0.0" }
  }
}
```

All package fields are optional. `description` is a single line of at most 512 UTF-8 bytes. `authors` contains one to 32 people or organizations, each with a required `name` of at most 128 bytes and optional `email` and `url`. URLs must use HTTPS, contain no credentials, query or fragment, and fit within 1024 bytes. `repository` is the public HTTPS URL of the Git repository. Unknown fields, duplicate authors, control characters and malformed values stop the build. The [configuration schema](../schema/lean-export-configuration.schema.json) describes the structure; validation also checks UTF-8 byte limits.

| Target | Generated fields |
| --- | --- |
| npm, including PHP-Wasm | `description`, first author in `author`, remaining authors in `contributors`, `homepage`, `repository` |
| PyPI | `Summary`, `Author` for names without email, `Author-email` for mailboxes, `Home-page`, `Project-URL: Source` |
| Cargo | `description`, `authors`, `homepage`, `repository` |
| NuGet | `description`, author names in `authors`, `projectUrl`, `repository` |
| Maven | `description`, `developers`, `url`, `scm` |
| RubyGems | `summary`, `authors`, `email`, `homepage`, `metadata.source_code_uri` |
| CPAN | `abstract`, `author`, `resources.homepage`, `resources.repository`; installation retains these in `MYMETA` |
| Composer, native PHP and PHP-Wasm | `description`, `authors` with author URLs in `homepage`, package `homepage`, `support.source` |
| C, C++, WIT/WASI | Root `package-metadata.json` with the complete shared declaration |

The npm bundle retains the source configuration. Native and PHP-Wasm receipts retain its exact text in `sourceIdentity.exportConfigurationSource`, checked against the captured source hash and configuration hash before packaging. Formats with fewer author fields still retain the original declaration in their compiled provenance. Package assembly needs no live source checkout. Shared-runtime packages keep their own metadata.

These values come from `lean-bridge.exports.json`, not from Git settings, a developer's environment, or Lake's descriptive fields. When omitted, optional fields stay absent; required author fields use `Author not declared`. The separate reviewed Alpha recipes keep their existing metadata.

The [metadata acceptance record](evidence/package-metadata-20260916.md) covers independent archive inspection, relocated installations, exact source checks and shared-runtime ownership.

The field mappings follow the registry specifications: [npm package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json), [Python core metadata](https://packaging.python.org/en/latest/specifications/core-metadata/), [Cargo manifests](https://doc.rust-lang.org/cargo/reference/manifest.html), [NuGet nuspec](https://learn.microsoft.com/en-us/nuget/reference/nuspec), [Maven POM](https://maven.apache.org/pom.html), [RubyGems gemspec](https://guides.rubygems.org/specification-reference/), [CPAN metadata](https://metacpan.org/pod/CPAN::Meta::Spec), and [Composer schema](https://getcomposer.org/doc/04-schema.md).

## Declare license terms

`package.license` sets the publisher's license expression for the generated component packages. Use canonical, nondeprecated identifiers and exceptions from SPDX 3.28, combined with `AND`, `OR`, `WITH`, `+` and parentheses. The offline validator limits expressions to 512 ASCII characters and 32 nested groups. `LicenseRef` and deprecated identifiers are not admitted. Each registry can enforce its own, older license list. The pinned identifier data and upstream hashes are in [spdx-data.json](../src/analyze/spdx-data.json). [SPDX expression syntax](https://spdx.github.io/spdx-spec/v2.3/SPDX-license-expressions/).

`package.licenseFiles` adds exact source-relative filenames to automatic notice discovery. In the example above, create both files under `legal/` with the applicable terms. Up to 32 unique paths are allowed, each at most 512 characters and 16 path segments. Use ASCII letters, digits, spaces, `_`, `-` and `.` within names. Absolute paths, traversal, globs, hidden files, build/dependency directories, symlinks, missing files and empty terms fail the build. Lake dependencies can declare their own paths in their own `lean-bridge.exports.json`; those declarations are checked against the captured dependency bytes.

| Target | License declaration |
| --- | --- |
| npm, including PHP-Wasm; Composer; Cargo | `license` contains the exact expression |
| PyPI | Core metadata 2.4 `License-Expression`, plus `License-File` entries for bundled terms and notices |
| NuGet | `<license type="expression">` |
| Maven | One `licenses/license/name` containing the complete expression; Boolean terms are not split into unrelated licenses |
| RubyGems | A single supported term in `license`; compound or overlong terms use `Nonstandard`. `metadata.spdx_expression` always retains the declared expression |
| CPAN | An exact mapping where its vocabulary permits one, otherwise `unknown`. `x_spdx_expression` retains the expression in `META.json` and installation's `MYMETA.json` |
| C, C++, WIT/WASI | `license` and `licenseFiles` in `package-metadata.json` |

RubyGems' license array does not distinguish `AND` from `OR`; CPAN has a smaller fixed vocabulary. The extra metadata preserves the publisher's expression without changing those semantics. [RubyGems license fields](https://guides.rubygems.org/specification-reference/#license), [CPAN license vocabulary](https://metacpan.org/pod/CPAN::Meta::Spec#license), [Python license metadata](https://packaging.python.org/en/latest/specifications/core-metadata/#license-expression).

Ordinary JavaScript npm builds still accept a license from the source `package.json` when `package.license` is absent. If both declarations exist, they must match exactly. Native and PHP-Wasm builds do not infer a license from npm metadata. Without a shared declaration they retain notices but leave the ecosystem license absent or unspecified. Shared-runtime packages keep their own terms. Choose an expression appropriate to the files you distribute, including bundled dependencies; the build does not infer licensing rights from file contents.

## Retain library and dependency licenses

Keep your library's license and redistribution notices in its source tree, and retain those supplied by its Lake dependencies. Lean Bridge captures files named `LICENSE`, `LICENCE`, `LICENSES`, `NOTICE`, `NOTICES`, `COPYING` or `COPYRIGHT`, including case variations, suffixed filenames and nested paths. It also captures files inside `LICENSES/` directories. Lean source and other code files do not become notices merely because they are named `Notice.lean` or `License.js`.

Native and PHP-Wasm compilation writes `source-notices.json` with each package's name, source identity, original notice paths and payload hashes. Package assembly checks this inventory against the compilation receipt and includes the exact notice bytes. A package with no captured notices has an empty list. Lean Bridge does not assign its own MIT license to that library.

| Package | Source-notice inventory location |
| --- | --- |
| CPAN component | `notices/source-notices.json` |
| C, C++, WIT/WASI | `share/lean-bridge/licenses/source-notices.json` |
| Cargo, NuGet, RubyGems | `lean-bridge/licenses/source-notices.json` |
| Maven | `META-INF/lean-bridge/licenses/source-notices.json` |
| Python wheel | `<distribution>.dist-info/licenses/source-notices.json` |
| Native PHP, PHP-Wasm npm component and Composer API | `licenses/source-notices.json` |

Each inventory points to `source-notices/<sha256>.txt` beside it. The payload retains the original file bytes; the inventory retains its original filename. Identical notice bytes share a payload. Lean and Lean Bridge licenses remain separately named files. Shared runtime packages do not receive the consuming library's notices.

Ordinary JavaScript npm packages retain root notice filenames, nested root notices under `notices/source/`, and dependency notices under `notices/lake/`. Their `sbom.json` records the root notices, and `package.json` takes its license from the shared declaration, with the source `package.json` as the npm-only fallback. Custom root filenames that are not conventional notice names go under `notices/source/`, avoiding generated-file collisions.

Native and PHP-Wasm source-notice inventories use version two to retain each package's source-bound configuration alongside its notice inventory. Version-one inventories remain readable. License text, declarations and paths are checked before archives are assembled, including after the source directory has been removed. The [license acceptance record](evidence/package-licenses-20260916.md) lists archive inspections, installed consumers and integrity regressions.

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
| Ordinary native `native-release.json` and archive receipts | Runtime, component, Binding IR, and archive identities for C, C++, Perl, NuGet, Maven, RubyGems, WIT, PyPI, Cargo and native PHP. These are not universal signed transaction receipts. |
| Ordinary PHP-Wasm `php-wasm-release.json` and `php-wasm-package-set.json` | Compiled wasm32 inputs, npm runtime/component archives and Composer API identities. These are unsigned inventories, not CLI registry-transaction receipts. |
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
