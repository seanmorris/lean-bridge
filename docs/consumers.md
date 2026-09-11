# Runtime and package reference

The [versioned support contract](consumer-support.v1.json) records each runtime separately. A supported profile installs its documented package in a clean consumer and executes real Lean. This table is checked against that contract by the documentation tests.

## Tested profiles

| Consumer | State | Tested profile | Guide |
| --- | --- | --- | --- |
| JavaScript on Node | `supported` | Node 22 ESM with separate generated runtime and component npm archives | [JavaScript](javascript-typescript.md#javascript) |
| TypeScript on Node | `supported` | TypeScript 5.9 strict compilation to Node 22 ESM | [TypeScript](javascript-typescript.md#typescript) |
| Browser JavaScript | `supported` | Installed npm archive selected through a browser conditional export and bundled with Vite | [Browser JavaScript](javascript-typescript.md#use-the-package-in-a-browser) |
| Native PHP | `supported` | PHP 8.2 NTS on x86-64 Linux with glibc 2.38 or newer through the generated Zend extension | [php-native](consume/php-native.md) |
| PHP-Wasm | `supported` | PHP 8.4 in the Node-hosted php-wasm 0.1.0 runtime, lazy and startup profiles | [php-wasm](consume/php-wasm.md) |
| .NET | `supported` | .NET 8 on x86-64 Linux with glibc 2.38 or newer through the generated LibraryImport transport and NuGet package | [C# / .NET](consume/dotnet.md) |
| JVM | `supported` | JDK 22 on x86-64 Linux with glibc 2.38 or newer through finalized FFM and a Maven package | [java](consume/java.md), [kotlin](consume/kotlin.md) |
| Ruby | `supported` | MRI Ruby 3.3 on x86-64 Linux with glibc 2.38 or newer through Fiddle and a RubyGem without a native extension build | [ruby](consume/ruby.md) |
| Perl | `supported` | Perl 5.36.3 and 5.38.2, threaded and nonthreaded, on x86-64 Linux with glibc 2.38 or newer through generated XS and hybrid CPAN distributions | [Perl](consume/perl.md) |
| Python | `supported` | Python 3.11 or newer on x86-64 Linux with glibc 2.38 or newer through the generated wheel and native runtime adapter | [python](consume/python.md) |
| Rust | `supported` | Rust 2021 crate on x86-64 Linux with glibc 2.38 or newer and the packaged native runtime adapter | [rust](consume/rust.md) |
| C | `supported` | C11 package on x86-64 Linux with glibc 2.38 or newer, CMake, and pkg-config discovery | [c](consume/c.md) |
| C++ | `supported` | C++20 package on x86-64 Linux with glibc 2.38 or newer, typed RAII wrappers, and CMake discovery | [C++](consume/cpp.md) |
| WIT/WASI | `supported` | Component Model adapter in the pinned Wasmtime 42 host profile on x86-64 Linux with glibc 2.38 or newer | [wit-wasi](consume/wit-wasi.md) |

The JavaScript examples install the prepared `onboarding-small` npm release. Native, managed, PHP, and WIT/WASI guides install the Alpha interoperability package. Read the named guide for its actual exports, installation format, and compiler or host requirements.

## Authenticate a release archive

[Use a prepared release](consume/receive-package.md#authenticate-a-signed-archive) covers the standalone verifier, trusted signer-policy hash, signed subject, and expected coordinate. Authenticate the original archive before installation or extraction.

## Browser JavaScript

The [JavaScript and TypeScript guide](javascript-typescript.md) includes a complete Vite project, React effects, and module-worker ownership using the same prepared archives. The support matrix also checks the installed Alpha npm browser export.

## Python

[Python](consume/python.md) covers the exact wheel, selected-interpreter compatibility preflight, isolated installation, generated values, and resource cleanup.

## Rust

[Rust](consume/rust.md) provides a complete Cargo project with an extracted archive dependency and the packaged native library's current location requirement.

## C

[C](consume/c.md) includes a complete C11 program and CMake project, explicit status checks, and cleanup for resources and copied buffers.

## C++

[C++](consume/cpp.md) uses the C++20 archive's typed values and RAII wrappers, with a complete CMake project.

## .NET, JVM, and Ruby

[C# / .NET](consume/dotnet.md), [Java](consume/java.md), [Kotlin](consume/kotlin.md), and [Ruby](consume/ruby.md) each have their own installed-package guide. Java and Kotlin consume the same generated Maven artifact through JDK 22's FFM API.

## Perl

[Perl](consume/perl.md) covers prepared CPAN packages, automatic runtime loading, exact integers, copied records and arrays, resources, callbacks, and XS-only fallback installation.

## WIT and WASI

[WIT / WASI](consume/wit-wasi.md) explains the executable adapter entry point, the bundled Wasmtime host, and the broader WIT projection. The adapter requires its typed native host import.

## Promotion rule

CI checks package installation and real Lean execution for all supported profiles. [Consumer acceptance evidence](evidence/native-consumer-acceptance.md) and the versioned contract identify the commands and records behind those states. A newly documented example does not change a support state by itself.
