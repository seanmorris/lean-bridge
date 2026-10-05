# JVM corpus CI repair, 22 September 2026

The [downstream run for a0b08c0](https://github.com/seanmorris/lean-bridge/actions/runs/35763351046)
reported two JVM-related failures. The combined-package job selected the runner's
Kotlin compiler instead of version 2.2.0. The managed corpus rejected the new
Maven-resolved runtime dependency layout.

## Pinned compiler

The combined job now downloads Kotlin 2.2.0, verifies its SHA-256, and explicitly
selects its compiler and the configured JDK. A workflow test checks those steps.
The original version rejection reproduced locally with Kotlin 2.4.20.

The combined shop test passed with the pinned tools. It built thirteen packages
and fourteen archives across two ABI profiles, compared independently rebuilt
releases, hid the author sources, and installed the downstream packages. Local
native checks used this host's explicit glibc 2.36 test floor. CI keeps its
production floor of 2.38.

The test now removes the duplicate release after comparing both receipts and
every archive hash, before installing from the first release. The final-source
telemetry test passed with this cleanup. It verified four packages and four
archives across two ABI profiles, then checked both profile-specific receipts.

## Maven dependency evidence

Java and Kotlin consumers both deploy the package's Maven runtime closure:

- `org/jetbrains/kotlin/kotlin-stdlib/2.2.0/kotlin-stdlib-2.2.0.jar`
- `org/jetbrains/annotations/13.0/annotations-13.0.jar`

The old evidence validator admitted neither of these versioned files under
`dependencies/`. Its deployment assertion reproduced the rejection against
four existing installed Java/Kotlin records. Package execution itself had
succeeded.

The validator now requires both exact coordinates, binds resolved hashes to the
locked dependency inventory, and compares each deployed JAR's hash and byte
count with that inventory. It rejects other dependency paths. Twenty-four new
negative cases cover missing, duplicate, changed and undeclared dependencies,
compiler JARs, unsafe paths and the obsolete standard-library location.

The ordinary corpus passed all 443 tests. The reviewed corpus also passed.
Each source path rebuilt both shop and telemetry, installed Java and Kotlin
consumers offline, and executed them again from source-free, compiler-free,
runtime-only deployments. Each path covered 248 catalog cases: 204 executed
cases and 44 compile-time rejections. These are scoped regressions, not new
recursive-type coverage.

Reports are `build/type-corpus/java-kotlin.json` and
`build/type-corpus/reviewed-native-java-kotlin.json`. Historical installed
receipt JSON remains unchanged.

## Reproduce

```sh
LEAN_BRIDGE_TYPE_CORPUS_PROFILES=java,kotlin \
  node --test tests/type-corpus.test.mjs
LEAN_BRIDGE_REVIEWED_NATIVE_PROFILES=java,kotlin \
  node --test tests/type-corpus-reviewed-native.test.mjs
```

Use the pinned JDK, Maven and Kotlin tools. On this local host only, set
`LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36` for the native build.

These repairs add no installed type-coverage cells and publish no packages.
