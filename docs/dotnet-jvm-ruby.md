# .NET, JVM, and Ruby consumers

Each language now has a standalone guide with installation commands, a complete program, expected output, and resource cleanup. These guides consume the Alpha interoperability package on the platform named in the [support contract](consumer-support.v1.json).

## .NET 8 and NuGet

Use the [C# and .NET guide](consume/dotnet.md) to restore the NuGet archive and run a .NET 8 console application.

## JDK 22, Kotlin, and Maven

Use the [Java guide](consume/java.md) for a complete Java class, or the [Kotlin guide](consume/kotlin.md) for a Kotlin program. Both resolve the same Maven artifact and launch on JDK 22 with native access enabled.

## MRI Ruby 3.3 and RubyGems

Use the [Ruby guide](consume/ruby.md) to install the original gem into an isolated gem home and release resources with `ensure`.

## Verification

[Receive a package](consume/receive-package.md) covers local and signed artifact handoffs. The [managed acceptance evidence](evidence/managed-consumer-acceptance.md) records installed-package checks. Contributors can [run the managed acceptance checks](contributing/testing.md#consumer-acceptance) against the public examples from the individual guides.
