# Ordinary-source Java, Kotlin and Maven copied values

VO1216 adds source-named Java APIs and prepared Maven JAR/POM files for ordinary Lean projects. The implementation is based on `9acb78a806770ac0a1673db232f8d9e8f1dce190`; the type inventory binds the milestone to its source and test hashes.

## Acceptance

```sh
source scripts/env.sh
JAVA_HOME=/app/.toolchains/jdk22 \
LEAN_BRIDGE_NATIVE_JVM_TEST=1 \
LEAN_BRIDGE_JAVAC=/app/.toolchains/jdk22/bin/javac \
LEAN_BRIDGE_JAVA=/app/.toolchains/jdk22/bin/java \
LEAN_BRIDGE_KOTLINC=/app/.toolchains/kotlin-2.2.0/kotlinc/bin/kotlinc \
LEAN_BRIDGE_KOTLIN=/app/.toolchains/kotlin-2.2.0/kotlinc/bin/kotlin \
LEAN_BRIDGE_MAVEN=/app/.toolchains/apache-maven-3.9.11/bin/mvn \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
node --test --test-reporter=spec tests/native-jvm.test.mjs
```

The local profile uses Temurin 22.0.2+9, Kotlin 2.2.0, Maven 3.9.11, GCC 12 and glibc 2.36 on Linux x86-64. The production profile retains the glibc 2.38 floor. Lean 4.32.2 is pinned to commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`.

Maple and Cedar each expose 41 functions and build from two relocated source trees. Their JAR/POM files match byte-for-byte. Maven's pinned install plugin installs the original files into a fresh local repository after both source locations are hidden. Java and Kotlin consumers call the generated public API; they do not build Lean or write FFM declarations. The first Maven run downloads plugin dependencies. The Lean package itself comes from the supplied archives.

Both languages exercise all 16 primitive input, result, array-element and record-field types, nested arrays and records, and scalar-represented records. Cedar reverses its leaf record's fields and uses UInt64 for a single-field record where Maple uses UInt32. Checks cover unsigned maxima, signed minima, 4096-bit BigInteger values, Unicode with embedded NUL, signed zero and independent copied output arrays. Java also checks empty values, NaN/infinity, malformed UTF-16, invalid unsigned values, negative Nat, nested nulls, oversized inputs, repeated output-budget failures and concurrent callers. Kotlin independently checks negative Nat rejection.

The two-package Java consumer observes one native runtime initialization, two component initializations and two attached components. Two isolated class loaders also load and call the same JAR. Private native extraction directories are absent after normal JVM shutdown. Modified native libraries fail hash verification before loading, and an altered compiled class fails package assembly. A missing Java compiler leaves no partial release or staging directory. Invalid ambient Java options do not affect the isolated compiler invocation.

All four top-level JVM checks pass. The locally installed Maven artifacts are:

| Artifact | SHA-256 |
| --- | --- |
| `maple-api-2.0.0-rc.1.jar` | `cb42af457a3a99cdcc3f6c84d9ca0c8dc675dc0d79e94fb9ae64006d573ca466` |
| `maple-api-2.0.0-rc.1.pom` | `1c5b8414ed85705b0f3f13e3fb13fcc59cc647edba80593e6a64e4f8dabe6a8f` |
| `cedar-api-2.0.0-rc.1.jar` | `be52035b900b7c2a0aea8cd2e9ca1e0fd8f632322243ce0d34b0043df6e8e70c` |
| `cedar-api-2.0.0-rc.1.pom` | `d6aeba6114aa5fbc008f1997f5842f917ecdfc5eddb79078b69e4c91465e07b8` |

## Shared build and scope

Both fixtures project C and Maven from the same native compilation. Shop builds npm, CPAN, C, C++, NuGet and Maven with one native and one Wasm compilation. The mixed-profile runner uses real compilers through an injected Nix-command transport; this local check does not execute Nix itself.

The milestone advances 108 ordinary-source type cells: input, result and field positions for 16 primitives, arrays and records, independently for Java and Kotlin. Existing Alpha resource/callback APIs remain separate. Ruby, WIT/WASI, reviewed-IR, optional, callback and further type-family cells do not advance.

Only pure copied, acyclic types up to 32 levels are admitted. Input/output native conversions share a 16 MiB budget; Java bounds input scratch separately. Lean's own working memory is outside that conversion budget. FFM arenas release temporary memory, and generated deep clear calls release native results even when conversion throws. This acceptance does not inject Java allocation failures or establish collectible native-library unloading. Native handles live for the process lifetime.

Prepared archives contain compiled classes, native libraries, generated sources, compiler evidence and dependency license notices. Generic package-set receipts and signed publication integration remain under VO1240. No registry upload or Pages deployment occurs in this acceptance.
