# C11: ownership of a function stored in a record

The [Tariff package](../../tests/fixtures/onboarding/leased-closure-fields/Owned.lean)
contains a field of type `UInt32 → UInt32`. Its C11 consumer uses only the
shipped header. A separate test executable observes the installed runtime.
These are local Linux x86-64 checks (Lean 4.32.2, glibc 2.36).

| Source | Package-set SHA-256 | Archive SHA-256 |
| --- | --- | --- |
| [Ordinary](c-leased-closure-fields-20261125/ordinary.json) | `03bee4c4b036a9b727002c74b8a14a4c6889f7ffeb5243b352ae557c87094d54` | `66cd1e0031962453e4e04e9a7fdbd37f0aa40aeec5330a629de14de5049b400a` |
| [Independently reviewed](c-leased-closure-fields-20261125/reviewed.json) | `75468e0afb63a1feb21b26d0ebccd4d6560f7c515fb454242fd1453323e2926d` | `5bbc928f26d10f1e8c9f73d2cf7654fd960cf3c37b59506c9f9e2444d483df39` |

The [public client](../../tests/fixtures/structured-types/leased-closure-fields.c)
exercises six cases. Copying the record, echoing it through Lean, and extracting
its function all preserve the captured price after the original owner releases
it. Repacking the extracted closure and explicitly retaining it give independent
owners. The same handle is rejected by a different session. Releasing the last
lease makes a saved alias invalid. Passing a ticket as a function also fails.
Finally, putting a borrowed C callback in a returned record does not extend its
lifetime: direct and record-mediated calls return `CALLBACK_FAILED` without
invoking the C function. Failed calls leave the caller's output unchanged and
publish no owner. A subsequent valid call succeeds.

The harness installs the verified package after deleting the Lean project and
producer, then compiles the application with pkg-config. It removes the handoff,
moves the installed library and recompiles with its CMake export. The
[CMake test probe](../../tests/fixtures/structured-types/leased-closure-field-leases.c)
holds a separate session open while the application runs. The observed counts
were **0 → 1 → 2 → 1 → 0**: before either session, with the independent
session open, after the client releases its children but before closing its
own session, and after each session closes. The client never calls the probe.
The [ordinary](c-leased-closure-fields-20261125/ordinary.execution.json) and
[reviewed](c-leased-closure-fields-20261125/reviewed.execution.json)
execution records bind those measurements and both build-system results to
the package receipt, client and probe hashes.

The ordinary archive (53,834,502 bytes) was installed from the exact retained
bytes. The original build's external retention helper hard-linked the archive
while it was being hashed, changing its inode timestamp. The verifier refused
that attempt. The replay created an isolated handoff with the original receipt
and archive, regenerated the receipt's hash sidecar, and verified both before
installing. The reviewed build passed directly from the independently stated
interface (53,835,678-byte archive). The final instrumented clients were run
on fresh installs of both archives. No archive was rebuilt or repackaged for
either replay.

Reproduce with `npm run test:c-leased-closure-fields`. Set `LEAN_BRIDGE_CMAKE`
to an absolute path if CMake is not at `/usr/bin/cmake`. This is a scalar
Lean function field, not a field holding a permanently registered host callback
or a captured application object.
