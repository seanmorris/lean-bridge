# Calling a Lean closure stored in a Python record

Local Linux x86-64, CPython 3.12.14, glibc 2.36, Lean 4.32.2. This
exercises the [Tariff package](../../tests/fixtures/onboarding/leased-closure-fields/Owned.lean):
the value under test is the field `quote : UInt32 → UInt32`, not just the
return value of a function that hands back another function.

| Source | Package-set receipt SHA-256 | Installed wheel SHA-256 |
| --- | --- | --- |
| Ordinary Lean source | `a84417e1fbdc085ba4c27eba3f140675b0dfa389f1267c6b73ef33641bb46de8` | `6e28c2e70157e37f7e9aa662ac8aa39f3b425d6c33a263ef4af7b3776aedca25` |
| Independently authored, freshly checked review | `a01b153163fc1c01ffa54e72cf61e7297df9ccbafe53c3ec6f2a0236dafd0a8d` | `10af7fa3d9c481c072fe2f40b89116c1ae1c4aeba5c89ea8d5659d5ff2f0fe72` |

The original package-set receipts for the [ordinary](python-leased-closure-fields-20261125/ordinary.json)
and [reviewed](python-leased-closure-fields-20261125/reviewed.json) wheels
also identify the source tree and binding interface for each build.

The [client](../../tests/fixtures/structured-types/leased-closure-fields.py)
imports the installed package without configuring a shared runtime. It copies a
record, extracts its function, and closes the original function wrapper. The
copy and extracted function still calculate distinct prices from the captured
base. A closed wrapper, a ticket of the wrong type, and an ordinary Python
lambda in a record are all refused. A lambda passed through the legitimate
call-borrowed callback parameter does not become durable when Lean returns
it inside a record: both direct and record-mediated invocation fail with
callback status 10, the lambda never runs, and a subsequent valid call works.

The [lifetime probe used for these wheels](https://github.com/seanmorris/lean-bridge/blob/984be4d3133fbb1166dfd7c880f7f8e8f80f7bff/tests/fixtures/structured-types/leased-closure-field-leases.py)
reads native identity counts from the same library that the normal import
loaded. With client globals still holding the closed wrappers, the
sequence is **0 before opening a session → 1 session identity → 1 session
identity and zero result slots after the client → 0 after session close**.
It does not force garbage collection. An earlier probe incorrectly expected
zero while the session was still open. The corrected probe passed an offline,
relocated reinstall of the exact ordinary wheel (53,865,696 bytes), verified
against the original receipt; no recompilation or repackaging was involved.
The reviewed wheel (53,869,337 bytes) passed the same consumer and lifetime
probe. Both receipts identify runtime
`435df3ba25c15f046436350294d649cec8014446ac00b9610150ec6b173b03d0`.
The input to the second build was the
[independently written contract](../../tests/helpers/owned-aggregate-fixture.mjs),
not the interface emitted by the ordinary build.

Run `npm run test:leased-closure-fields` with the pinned producer toolchain
and a Python interpreter. The [test](../../tests/leased-closure-fields-install.test.mjs)
builds from source or an independently stated reviewed interface, verifies
the handoff, removes the sources, installs offline and relocates the client.
These local results do not establish callable-field support on other hosts.
