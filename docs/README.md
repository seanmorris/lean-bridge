# Documentation map

Follow the workflow for the package you are building or the application you are writing.

## Choose your starting point

| Your task | Start here | Result |
| --- | --- | --- |
| Create or adapt a Lean library and distribute it | [Build and publish a Lean package](lean-author-guide.md) | Checked source, a supported application API, and installable downstream packages. |
| Use a published package in an application | [Use a published Lean package](consume.md) | Installation with your language's tools, an executable example, and integration guidance. |

## Follow one complete example

Authors can [create the tutorial library](lean/first-component.md) or [adapt an existing library](lean/existing-package.md), then choose the [target language and package format](publishing.md). The npm tutorial checks an addition theorem, builds the component, and verifies its local package archives.

Application developers start with a completed release. The [JavaScript and TypeScript guide](javascript-typescript.md) covers Node, browsers, React, and workers. The [consumer overview](consume.md) links every supported language and identifies the example packages.

## User guides

| Application language | Installation and use | Build and publish |
| --- | --- | --- |
| JavaScript, TypeScript, browser, React, workers | [JavaScript and TypeScript](javascript-typescript.md) | [npm](publish/npm.md) |
| Python | [Python](consume/python.md) | [PyPI](publish/pypi.md) |
| Rust | [Rust](consume/rust.md) | [Cargo](publish/cargo.md) |
| C | [C](consume/c.md) | [C packages](publish/c.md) |
| C++ | [C++](consume/cpp.md) | [C++ packages](publish/cpp.md) |
| C# / .NET | [C# / .NET](consume/dotnet.md) | [NuGet](publish/nuget.md) |
| Java and Kotlin | [Java](consume/java.md), [Kotlin](consume/kotlin.md) | [Maven](publish/maven.md) |
| Ruby | [Ruby](consume/ruby.md) | [RubyGems](publish/rubygems.md) |
| Perl | [Perl](consume/perl.md) | [CPAN](publish/cpan.md) |
| PHP | [PHP, native and Wasm](php.md) | [Composer and npm](publish/php.md) |
| WIT / WASI | [WIT / WASI](consume/wit-wasi.md) | [WIT / WASI packages](publish/wit-wasi.md) |

[Use a prepared release](consume/receive-package.md) covers archive verification and signed Nix cache consumption. The [runtime reference](consumers.md) lists tested platform requirements.

## Publish by ecosystem

Publishing is part of the author workflow. The language guides above retain package-manager setup, package creation, credentials, uploads, verification, and recovery. [Choose targets and package formats](publishing.md) explains their build inputs and available delivery paths.

Use [archive distribution](publish/archives.md) for approved tarballs and [signed Nix publication](publish/nix.md) for binary caches.

## Understand the demos

- [Understand and adopt a verified core](concepts/index.md) connects change checks, evidence, reusable APIs, and integration.
- [Dijkstra on a delivery graph](concepts/dijkstra.md) and [Flood fill with keys and permissions](concepts/flood-fill.md) include executable examples.
- [From proof to browser result](concepts/lean-to-wasm.md) follows a guarantee through compilation.
- [Read the benchmarks](concepts/benchmarks.md) explains the measurements.
- [Use a demo's local API](demo-api.md) calls a compiled solver without its webpage.
- [Run the algorithm collection](../demos/index.html) to change inputs and inspect results.

## Look up a contract

- [CLI reference](reference/cli.md): commands, configuration, results, and exit codes.
- [Generated package API](reference/package-api.md): declarations emitted for the tutorial packages.
- [Types and values](reference/types.md): conversion rules and position-specific coverage.
- [Algorithm APIs and proofs](reference/algorithms.md): adapters, theorems, and source-checked receipts.

Read [Combine Lean packages](concepts/shared-runtime.md) and [Ownership and cleanup](concepts/ownership.md) when integrating resource APIs.

## Contributor workflow

[Contributing](../CONTRIBUTING.md) covers implementation, documentation, tests, demos, Lean Bridge releases, and site deployment. These procedures maintain the bridge itself.

## Claim ownership

The [documentation ownership map](../site/README.md#claim-ownership) identifies the sources for requirements, support states, and executed evidence.

## Architecture and evidence

The [architecture index](architecture/README.md) records interoperability and safety decisions. The [evidence index](evidence/README.md) records executed commands and acceptance results. Historical plans and evidence retain their original scope.

## Style and references

Follow the [writing and reference guidance](../site/README.md#style-and-references) when changing documentation.
