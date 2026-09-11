# Use a published Lean package

Install the package for your language, import its generated API, and call it from your application. Start with the publisher's completed release; you do not need Lean or Lake.

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
| Perl | CPAN distribution with native Lean and generated XS | [Perl](consume/perl.md) |
| PHP, native or Wasm | Native extension with Composer library, or a PHP-Wasm npm package | [PHP](php.md) |
| WIT / WASI | Component and host archive | [WIT / WASI](consume/wit-wasi.md) |

The JavaScript examples install `onboarding-small@1.0.0`, which exports `add` and `isEmpty`. Perl uses the Workshop package. The other native, managed, PHP, and WIT/WASI examples install the Alpha interoperability package in their language's format. Each guide names the exact archive and API it uses; the examples do not assume a public registry release.

The [runtime and package reference](consumers.md) lists the tested platform for every supported consumer. [PHP](php.md) compares its two runtime options. The [demo API guide](demo-api.md) covers the algorithm demos' local APIs separately.

### Verify a release

[Use a prepared release](consume/receive-package.md) identifies the files to request and the verification steps for each handoff. Continue with your language guide's install command, program, expected output, and cleanup steps.

JavaScript packages declare their runtime dependency, and their imports load it automatically. A local npm handoff includes the runtime archive alongside the component so the install can resolve both without a registry copy.

Consumers need their application toolchain and the platform named by the package. They do not need Lean or Lake. Nix users can receive the flake's outputs from a [signed binary cache](consume/receive-package.md#install-from-a-signed-nix-cache), with a trusted cache key and substitution checks.

## Start from a raw Lean package

Follow [Adapt an existing library](lean/existing-package.md) to prepare an installable package, then return to the language guide above.

### Start with the tutorial package

The [author tutorial](lean/first-component.md) builds the example package from source.

### Produce or publish a package

Use the [build-and-publish workflow](lean-author-guide.md), including its [target-language and package-manager guides](publishing.md).
