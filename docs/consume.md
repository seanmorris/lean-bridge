# Use a Lean package

Install a prepared release and call its generated API from your application. The language guides start with the completed package; building from Lean source is a [separate workflow below](#start-from-a-raw-lean-package).

## Use a prepared release

Get the package for your language and platform from its publisher, either through the configured registry or as an archive. The package supplies the compiled Lean code and its runtime dependency. Use your application's language tools to install and call it.

### Choose your language

| Application | Prepared package | Guide |
| --- | --- | --- |
| JavaScript, TypeScript, browser, React, and workers | npm package | [JavaScript and TypeScript](javascript-typescript.md) |
| Python | Platform wheel | [Python](consume/python.md) |
| Rust | Cargo crate with native libraries | [Rust](consume/rust.md) |
| C | Native archive and CMake target | [C](consume/c.md) |
| C++ | Native archive and CMake target | [C++](consume/cpp.md) |
| C# / .NET | NuGet package | [C# / .NET](consume/dotnet.md) |
| Java | Maven JAR and POM | [Java](consume/java.md) |
| Kotlin | The same Maven JAR and POM as Java | [Kotlin](consume/kotlin.md) |
| Ruby | RubyGem | [Ruby](consume/ruby.md) |
| Native PHP | Compiled extension and Composer library | [Native PHP](consume/php-native.md) |
| PHP-Wasm | npm package for the PHP-Wasm host | [PHP-Wasm](consume/php-wasm.md) |
| WIT / WASI | Component and host archive | [WIT / WASI](consume/wit-wasi.md) |

The JavaScript examples install `onboarding-small@1.0.0`, which exports `add` and `isEmpty`. Native, managed, PHP, and WIT/WASI examples install the Alpha interoperability package in their language's format. Each guide names the exact archive and API it uses; the examples do not assume a public registry release.

The [runtime and package reference](consumers.md) lists the tested platform for every supported consumer. [PHP](php.md) compares its two runtime options. The [demo API guide](demo-api.md) covers the algorithm demos' local APIs separately.

### Receive a release

[Receive a package](consume/receive-package.md) identifies the files to request and the verification steps for each handoff. Continue with your language guide's install command, program, expected output, and cleanup steps.

JavaScript packages declare their runtime dependency, and their imports load it automatically. A local npm handoff includes the runtime archive alongside the component so the install can resolve both without a registry copy.

Consumers need their application toolchain and the platform named by the package. They do not need Lean or Lake. Nix users can receive the flake's outputs from a [signed binary cache](publish/nix.md), with a trusted cache key and substitution checks.

## Start from a raw Lean package

If you received `.lean` files and a Lake project, prepare a host-language package before installing it in your application:

1. Complete [author setup](lean/setup.md) and check the [supported exports](lean/export-decisions.md).
2. [Analyze, build, and create local archives](publish/local-handoff.md#prepare-the-lean-project) from the source project's root. The local dry run checks two builds without uploading a package.
3. Verify the resulting handoff and follow the prepared-release installation for its target language.

The documented ordinary Lake-project workflow produces npm archives. The Alpha builds for Python, Rust, C, C++, managed runtimes, PHP, and WIT/WASI use target-specific inputs and compiled bundles from this repository. A raw Lake project alone does not supply those bundles or their target API metadata. Each language page links its Alpha build path separately.

### Start with the tutorial package

[Build your first component](lean/first-component.md) gives the exact Lean source and build steps for `onboarding-small`. Once its archives exist, use the [JavaScript and TypeScript guide](javascript-typescript.md) for Node, browsers, React, and workers.

### Produce or publish a package

[Package a Lean library](lean-author-guide.md) covers source preparation. [Share a local package](publish/local-handoff.md) prepares an archive handoff; [Publish a Lean package](publishing.md) covers ecosystem releases and their authorization.
