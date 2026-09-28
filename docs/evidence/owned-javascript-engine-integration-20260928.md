# Owned npm engine integration

VO 1219. This milestone adds source-only owned npm requests to the component
engine. It preserves the copied build request and compiler-only analysis paths.

The caller captures the root package, locked dependencies, export decisions and
review before selecting Nix or Docker. Schema 4 authorizes a fixed component
output set. The output reader reconstructs that request and verifies the compiled
API against the captured source, fresh compiler metadata, module interfaces,
notices and generated-source records. A changed source, extra artifact, symlink,
wrong backend or altered output authorization is rejected.

The archive-derived Emscripten SDK records the immutable release hash used by
Nix. The compiler accepts that origin or the pinned SDK checkout, rejects
ambiguous origins, and checks compiler bytes before and after compilation.
No synthetic Git checkout is needed.

Enabled tests compile both ordinary and reviewed 51-export APIs. They install
npm packages offline after removing producer files. A generated-source fixture
combines generated Lean, generated C, local and locked Git dependencies with an
owned resource. Its installed consumer checks the Lean result, 32. The test
verifies C compilation and its include identities; it does not call foreign C
from Lean. Unreviewed foreign implementations remain rejected.
Installed CLI regression checks include a combined npm/native-C build.

The engine transport in these tests is injected. It runs the real compilers but
does not establish Nix or Docker isolation. Actual isolated installed acceptance
and signed publication remain open. No support table classifications change.

The same milestone fixes four reproduced CI causes:

- The filtered core build omitted dependencies needed by the projection generator.
- Reviewed npm rejection escaped the canonical build error wrapper.
- The JVM job downloaded Kotlin before creating its output directory.
- Native cancellation left a timer queued, causing the runtime's shutdown guard
  to reject finalization. Cancellation now clears the timer, unlinks the pending
  entry and releases it synchronously. Live work still blocks raw shutdown.

The successor JSON receipt binds the source changes and no-skip execution logs.
Earlier receipts remain unchanged. Historical verifiers reverse only complete,
authenticated source changes.
