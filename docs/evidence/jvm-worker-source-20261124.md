# JVM worker class contracts checked by Lean

The [compiler test](../../tests/helpers/jvm-worker-elaboration.mjs) builds the
[Jobs fixture](../../tests/fixtures/jvm-host-workers/Jobs.lean) from ordinary
source, then uses its public Binding IR as the reviewed selection without an
export list. Both builds produced IR SHA-256
`d47a7801f018efb485f8c7a1673cf608ab5d6103dc6fd3ab143baf2f52856c4d`.

Lean checked the imported Java class, its task and callback carriers, returned
`Except`, thrown `EIO`, and the cursor's item and terminal error. The test
compiled the generated task entry to C and checked its C declarations against
that output. Replacing the captured host source was rejected before invoking
Lean. An attempted Java member call from a worker through a private Lean
helper was rejected on fresh compilation.

This is compiler evidence, not an installed Maven release. It does not
establish Java delivery, Kotlin cancellation, or JNI cleanup. Reproduce it
with `node --test --test-concurrency=1 tests/helpers/jvm-worker-elaboration.mjs`
and the project's pinned Lean toolchain.
