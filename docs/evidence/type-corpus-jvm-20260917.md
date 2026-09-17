# Shared Java and Kotlin corpus, 2026-09-17

VO 1217. Java and Kotlin consumers install prepared Maven packages for `Shop.Pricing` and `Telemetry.Readings`. Both call the public generated API and compare observations with fresh Lean results. Production generators and the type-support inventory are unchanged.

## Public signatures and host rules

Each library exports 19 functions. Reflection checks independently specified public static method types, record component names and order, constructor types and accessors. Kotlin also assigns each public method to an explicitly typed function reference. Expected signatures come from the shared catalog, not generated source text.

`Nat`, `Int` and `UInt64` use `BigInteger`. The exact integer cases exceed 4,096 bits. Smaller unsigned values use wider signed host types. Negative `Nat` inputs, including a record field, and out-of-range unsigned inputs must throw `IllegalArgumentException` with the expected message. The next valid call must match Lean.

Wrong argument types and invalid signed literals must fail compilation. Each input gets a separate source file. The harness requires exit status 1 and the expected diagnostic at that file's source location. Java uses `javac -XDrawDiagnostics`; Kotlin uses internal diagnostic names. Missing dependencies and unrelated compiler errors cannot count as a rejected input. Java accepts the catalog's integer-to-float conversions; Kotlin rejects those unconverted integer arguments.

Floating-point cases compare exact bits for finite values, signed zero, subnormals and infinities. NaN cases check classification. `Unit` uses the generated enum as input and returns `void`. Byte arrays and copied records use public JVM values.

## Ownership, errors and cleanup

Record calls must leave their inputs unchanged and return independent nested storage. The caller changes populated rows, replaces an empty input row, and mutates returned rows. Changes on either side must leave the other side unchanged.

Supplemental runtime checks cover null strings, bytes, arrays, records, nested rows, unit and `Nat`; malformed UTF-16 directly and in a record; oversized bytes and strings; and a combined input/output budget failure. Each check runs three times, requires the exact exception class, and follows rejection with a valid call compared against Lean.

Both runtime executions must produce identical observations. Every loaded native library must match the package's recorded bytes and come from its private extraction directory. That directory must be empty after normal process exit. These checks do not measure native allocation counts or class-loader unloading. The [ordinary JVM suite](../../tests/native-jvm.test.mjs) retains its separate concurrency, class-loader, package-composition and loader-tampering checks.

## Prepared packages and isolation

Both Lean libraries include local and pinned offline Git dependencies and three proved lemmas. The harness checks elaborated declarations against the independent catalog, builds each JAR/POM twice from relocated source trees, and compares archive hashes. It removes the Lean, oracle and producer trees before checking the relocated package-set receipt through the public CLI.

The author stage fetches Maven install plugin 3.1.4 and dependency plugin 3.8.1 with their dependency files. It excludes the corpus package from this build-tool snapshot and records every file's size and hash in a deterministic archive. Each consumer starts with an empty private repository and user home, verifies and imports the snapshot, then installs the exact prepared JAR/POM and resolves dependencies with Maven offline. The classpath must contain only the installed corpus JAR. Explicit settings exclude ambient Maven configuration.

Only the downstream caller is compiled. Java disables annotation processing and implicit source compilation; Kotlin uses explicit JDK, compiler and library paths. Reports bind the tool files, public declarations, package receipt, compiled projection, source programs, compiler diagnostics, Maven settings and resolved classpath.

The harness moves the caller classes and unchanged original package JAR, then removes the entire consumer project, installation and Maven cache. A `jlink` image with only `java.base` runs the deployment twice without compiler paths or runtime overrides. Kotlin needs only its separately hashed standard-library JAR at runtime. The shipped package JAR retains its source provenance; it is not stripped or repacked. Deployment and runtime hashes must remain unchanged.

## Local results

The JVM suite passes all 253 tests in 303.0 seconds. Four Maven builds reproduce both JAR and POM bytes. Across the four library/language installations, 172 positive catalog calls match fresh Lean, 32 invalid inputs reject at runtime and recover, and 44 invalid programs fail with the expected compiler diagnostics. All 144 supplemental error/recovery checks pass. The report records 82 scoped observed cells and 6,480 gaps.

The run used Temurin Java/Javac 22.0.2+9, Kotlin 2.2.0, Maven 3.9.11, Node 22.23.2 and Lean 4.32.2 (`f3b06c705e6c85f5314019d5d3baab0fec5b580c`) on x86-64 Debian 12. The local glibc floor override was 2.36; production and CI retain 2.38. Nix is unavailable locally, so this record does not claim local execution of the Nix-pinned engine.

The catalog and 39 source/harness files bind corpus identity `f78caed59f2bdea7574f6beef7025969377dc154adfdd7d999757f101b6d2fbf`. The standalone report is `build/type-corpus/java-kotlin.json`.

| Prepared artifact | SHA-256 |
| --- | --- |
| `shop-corpus-1.0.0.jar` | `c9a2f4ffce0c41d561cd3b6ac43232e629778eb89e47a4758f909be3888f67f5` |
| `shop-corpus-1.0.0.pom` | `84e35abcd92828c2a020764b6a1be024cede1672b1c645013c410a3ce31afefe` |
| `telemetry-corpus-1.0.0.jar` | `1a69dc0a90be97d26f1e88379948c9e4a2a046f5eb7da671abc5bced96742fb5` |
| `telemetry-corpus-1.0.0.pom` | `f46ae77c0bebd3dce108162bc88dac07fc73990381d05096830e4b01b57bc730` |

Both libraries carry native runtime identity `e7d08d91baf7f70d791a79bd611779d311201ce6b6530f478be4f8ff1113be1f`. Reproducibility compares relocated builds with the same target selection. Combined-profile packages can have different hashes because their captured export configuration selects additional targets.

The combined fourteen-profile regression passes all 253 tests in 1,010.7 seconds. Its 28 library/profile installations record 1,736 catalog cases: 1,498 executed, 178 rejected at compile time and 60 unsupported. Supplemental error/recovery checks also pass: 144 JVM, 60 .NET, 60 C/C++ and six Rust checks. The report records 529 scoped observed cells and 6,033 gaps.

The browser portion records 24 engine/variant executions, with 1,344 executed cases and 144 unsupported records. All profiles agree with the same fresh Lean results; native and WASM runtime/IR identities remain separate. Native and Perl glibc floor overrides are both 2.36.

The combined report is `build/type-corpus/browser-javascript-browser-react-browser-worker-c-cpp-dotnet-java-kotlin-node-javascript-node-typescript-perl-python-ruby-rust.json`. Both reports revalidate against the same corpus identity and coverage rules. The harness removed its temporary build and consumer directories after execution.

Core validation passes lint, checked-JavaScript types and 961 tests, with 54 compiler/runtime-gated skips. All 65 documentation tests, 111 site/demo tests, the site typecheck, production site build and type-inventory check pass. The inventory retains 656 installed-tested cells and 29,530 required gaps.

## CI and remaining work

The managed consumer job requires both the ordinary JVM suite and `npm run test:type-corpus:jvm`. It uploads `type-corpus-jvm-<commit>` from `build/type-corpus/java-kotlin.json`. A failed check or missing report fails the gate. `test:type-corpus:java` and `test:type-corpus:kotlin` select one language; `test:type-corpus:all-native` selects nine native adapters sharing eight package formats. The [testing guide](../contributing/testing.md#shared-real-lean-type-corpus) lists prerequisites and tool selectors.

Fourteen of seventeen shared-corpus adapters are implemented. PHP native, PHP-WASM and WIT/WASI remain. Reviewed-IR execution and other type families, positions and semantics remain open. Synthetic validator observations never become installed evidence. This milestone does not promote type-support inventory cells or publish a registry package.
