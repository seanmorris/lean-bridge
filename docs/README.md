# Documentation map

Build a Lean component, call it from an application, or prepare it for a release. Each guide names its example package and links to the commands, source files, and verification records it needs.

## Choose your starting point

| Your task | Start here | Result |
| --- | --- | --- |
| I write Lean | [Package a Lean library](lean-author-guide.md) | A checked source project, a component bundle, and two local npm archives. |
| I build applications | [Use a Lean package](consume.md) | Prepared-release installation and executable examples for every supported language and runtime. |
| I ship libraries | [Publish a Lean package](publishing.md) | Ecosystem-specific packaging, registry uploads, verification, and release records. |
| I contribute to Lean Bridge | [Contributing](../CONTRIBUTING.md) | Repository development, documentation, demos, tests, and site deployment. |

The CLI is currently installed from a local checkout. Follow [toolchain setup](lean/setup.md) before the author tutorial. An application consuming generated archives does not need the author toolchain.

## Follow one complete example

For a package you have already received, start with [prepared-release consumption](consume.md#use-a-prepared-release). The language guides install it directly and show the generated API in an application.

The author tutorial starts from Lean source for `add` and `isEmpty`, then adds an addition theorem. Lean checks the theorem; analysis records which functions can be exported and which theorem relationships it found. The build produces a component, and a reproducibility dry run produces the runtime and component archives.

Follow [Build your first component](lean/first-component.md), then [JavaScript and TypeScript](javascript-typescript.md). That guide covers Node, browser JavaScript, React, and workers using the same package. Native and managed guides use prepared Alpha releases documented in the [consumer overview](consume.md).

## Understand the demos

- [From proof to browser result](concepts/lean-to-wasm.md) traces the sweep-and-prune guarantee through Lean, compilation, and the browser adapter.
- [Read the benchmarks](concepts/benchmarks.md) explains warmup, medians, p95, histograms, and the JavaScript comparison.
- [Use a demo's local API](demo-api.md) calls a compiled box solver without the webpage.
- [Run the algorithm collection](../demos/index.html) to change inputs and inspect the results.

## Claim ownership

The [documentation ownership map](../site/README.md#claim-ownership) identifies where contributors update project summaries, architecture requirements, support states, and executed evidence.

## User guides

| Audience | Guide |
|---|---|
| Lean package authors | [Lean author guide](lean-author-guide.md) |
| Package recipients | [Receive a package](consume/receive-package.md) |
| JavaScript, TypeScript, browser, React, and workers | [JavaScript and TypeScript](javascript-typescript.md) |
| Library publishers | [Publishing guide](publishing.md) |
| Repository, documentation, and demo contributors | [Contributing](../CONTRIBUTING.md) |
| Python consumers | [Python](consume/python.md) |
| Rust consumers | [Rust](consume/rust.md) |
| C and C++ consumers | [C](consume/c.md), [C++](consume/cpp.md) |
| C# / .NET consumers | [C# / .NET](consume/dotnet.md) |
| Java and Kotlin consumers | [Java](consume/java.md), [Kotlin](consume/kotlin.md) |
| Ruby consumers | [Ruby](consume/ruby.md) |
| PHP consumers | [Native PHP](consume/php-native.md), [PHP-Wasm](consume/php-wasm.md) |
| Component Model consumers | [WIT / WASI](consume/wit-wasi.md) |
| Platform requirements | [Runtime and package reference](consumers.md) |

Guides describe commands that a user can execute with produced package archives. They state prerequisites, imports, calls, cleanup, receipt verification, and current blockers. A generated API preview does not become a supported workflow until the versioned support record and clean-consumer evidence agree.

## Publish by ecosystem

- [npm](publish/npm.md) for JavaScript, TypeScript, and PHP-Wasm packages.
- [PyPI](publish/pypi.md) for Python wheels and source distributions.
- [Cargo](publish/cargo.md) for Rust crates.
- [NuGet](publish/nuget.md) for C# and .NET packages.
- [Maven repositories](publish/maven.md) for Java and Kotlin packages.
- [RubyGems](publish/rubygems.md) for Ruby gems.
- [Composer](publish/composer.md) for native PHP distribution.
- [Archives](publish/archives.md) for C, C++, and WIT/WASI.
- [Signed Nix packages](publish/nix.md) for binary-cache publication and trusted substitution.

The [publishing overview](publishing.md) separates package creation, operator-run uploads, and signed release transactions. Each ecosystem guide names its current integration requirements.

## Architecture and evidence

The [architecture index](architecture/README.md) covers durable interoperability, safety, reproducibility, and ownership rules. Architecture decision records explain why the project selected a boundary and what alternatives it rejected.

The [React gallery and documentation-site plan](architecture/react-documentation-site-plan.md) describes the planned public site for Lean authors, downstream consumers, and publishers. It reuses the canonical guides above and keeps migration work separate from executed evidence.

The [evidence index](evidence/README.md) links executed commands, observations, measurements, and acceptance records. Contributors should follow the [evidence-writing guidance](../site/README.md#style-and-references) when recording a new result.

## Contributor workflow

Follow the [contributor workflow](../CONTRIBUTING.md#contributor-workflow) to update implementation, contracts, evidence, and documentation together. The contributor landing page also links the source, script, and test indexes.

## Style and references

The [style and reference guidance](../site/README.md#style-and-references) covers evidence, portable source links, public API examples, and documentation checks.
