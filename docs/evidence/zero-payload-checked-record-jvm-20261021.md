# Zero-payload checked records in Java and Kotlin

The immutable [hosted evidence archive](zero-payload-checked-record-jvm-20261021/index.json) records all four ordinary-source, reviewed-IR, full and result-only Java/Kotlin Maven package selections from [GitHub Actions run 39561655653](https://github.com/seanmorris/lean-bridge/actions/runs/39561655653). The archived artifact is `12328792684`; its SHA-256 is `045affb3211c377105d80eee673e84263ac052c85b7a674b5efc02338ab74252`.

Each selection reproduces the complete Maven package from two author roots, removes the author sources, installs without network access, relocates the installed tree and replays independently compiled Java and Kotlin callers. The run used Ubuntu 24.04, x64, glibc 2.39, JDK 22.0.2 and Kotlin 2.2.0 with a declared glibc 2.38 package floor.

The fixture distinguishes these values:

- proof-only `Witness`, checked through a selected nullary Lean constructor;
- `Token`, whose `Unit` field remains present;
- plain empty `Marker`;
- `Option Witness`, including explicit absence;
- arrays of zero-payload values; and
- the active and inactive branches of `Mark`.

Java exposes `Witness` as a nominal zero-component record. Kotlin exposes it as a nominal zero-property class. Neither representation is null, absent, Kotlin `Unit`, Java `void`, or interchangeable with `Marker` or `Token`. Arrays preserve their lengths and contain independent nominal values.

Full packages run the exact selected nullary constructor on checked inputs, reject null at the public boundary, preserve rejected caller values and recover on the next valid call. Result-only packages project Lean-produced proof-erased values without input-constructor metadata. Compiled probes also check public Java shape and Kotlin nullability.

The archive retains every JAR, POM, receipt, report, caller observation, terminal TAP stream, generated probe, tool identity, GitHub API record, artifact ZIP byte and exact producer, consumer, checker and archiver source closure at revision `a6173cade3bbe158baa1a5695e3e93e1037359b0`. The independent verifier is [`tests/helpers/zero-payload-checked-record-jvm-evidence.mjs`](../../tests/helpers/zero-payload-checked-record-jvm-evidence.mjs).

This evidence promotes copied parameter and result sites for the named fixtures in Java and Kotlin. It does not promote fields, callbacks, owned positions, other zero-payload shapes or another host. Lean, Java, Kotlin and the operating system remain trusted external toolchains.
