# Shared JVM compiler regressions

The current JVM compiler and Maven packager reproduce the original Java and
Kotlin collection packages. Both languages pass from ordinary Lean source and
independently reviewed IR. The four installed callers perform 633,010 assertions,
17,740 calls, 120 input rejections and 2,716 injected failure checks.

The [execution record](jvm-shared-regressions-20260924.json) retains the current
execution-source hashes, the four original compiler/packager sources, the
installed observations and the passing test log. It compares complete package
inventories, native libraries, public declarations, documented consumers and
failure observations with the unchanged
[original JVM record](native-recursive-jvm-regression-20260923.json).

Each caller installs offline into an empty Maven repository, removes producer
sources and the handoff, and runs again with only the required Java runtime.
The original four-gibibyte free-space guard passed without modification. Packages
retain their original glibc 2.36 declaration.

The source verifier accepts these four measured transitions:

- `src/build/compile-jvm-sources.mjs`
- `src/build/native-jvm-artifacts.mjs`
- `src/build/native-jvm-projection.mjs`
- `src/release/native-maven.mjs`

Two verifier integrations have exact reversible edits. Their complete original
hashes still match, including the existing PHP-Wasm regression checker. Thirteen
mutated records reject incomplete runs, changed archive identities, weakened
failure probes, altered source hashes, runtime dependencies and skipped tests.
Unrelated source edits also reject.

The earlier Java and Kotlin metadata receipts now use the measured wasm32
layout transition. Their compiler bodies and consumer checks reconstruct to
their complete original source hashes. Both receipts still match every generated
declaration, compiler rejection and recorded public observation. The new
`jvm-graph-metadata-source` tests reject unrelated, missing or duplicated edits.

Run the retained evidence checks with:

```sh
node --test tests/jvm-shared-regressions.test.mjs \
  tests/jvm-graph-metadata-source.test.mjs
```

Run fresh compiled installations with:

```sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_JVM_COLLECTION_TEST=1 \
LEAN_BRIDGE_JVM_COLLECTION_PROFILES=java,kotlin \
node --test tests/jvm-collections.test.mjs
```

CI runs both languages and retains its own installed report. This record verifies
the JVM-specific compiler changes. Shared native admission, recursive-profile
promotion and final structured-type acceptance remain separate checks.
