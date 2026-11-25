# Installed Python synchronous Lean iterators

Two versions of CPython installed the runtime and Counting wheels offline.
Each ran a client against an ordinary Lean-source package and again against
a package built from the reviewed Binding IR without an export-name list.
The producer, handoff and local wheel feed were gone before the relocated
client ran, and there was no Lean compiler on its path.

| Verified package-set receipt (SHA-256) | CPython 3.11.16 | CPython 3.12.14 |
| --- | --- | --- |
| Ordinary | `86b36148b51f38f8b16a7fc3b53ef40b43f2dfcc9984f12fbe72332455a885f2` | `d6ca23b315559ed602a0009639714584c1a9a389713588083da826c9af020733` |
| Reviewed | `95ec080376112fa3a542f873a642ef26040cea143f41358120753ab679c40080` | `136fb97d69d7be2700960cc40dcb3456657117bfe1f162c205e78ff4f317f3da` |

The [Lean fixture](../../tests/fixtures/python-sync-iterator/Counting.lean)
counts opens, pulls and closes separately. The [installed client](../../tests/fixtures/python-sync-iterator/client.py)
observed eight opens, sixteen pulls and eight closes, including one close
during interpreter shutdown. It checked:

- Constructing and closing an unused iterator does not open a cursor. Each
  `next()` performs one pull on the main thread; no event loop is needed.
- A yielded `None` is an item. Only Lean's `Option.none` ends iteration.
- A declared factory failure never opens a cursor. A typed step failure
  preserves its payload, and a step throwing `IO.Error` preserves its message.
- Exhaustion, a step failure and an early `break` inside a `with` block close
  once. A foreign thread cannot pull or explicitly close; dropping its last
  Python reference schedules disposal on the owner.

On the compiled fixture both builds also rejected a `BaseIO (Task …)`
operation in place of the immediate pull. Replacing the finalizer with a file
write required a filesystem grant. With that grant the audit assigned the
capability to the finalizer alone. The 3.11 run additionally checked that a
schema-valid review referring to a different pull function failed specifically
at reconciliation against Lean's compiled declarations.

Run `npm run test:python-sync-iterator` with the pinned Lean compiler and
native runtime, pip and Python development headers. Set `LEAN_BRIDGE_PYTHON`
to the interpreter to test. These are local installed-package results for
`native-python-io-v1`, not evidence for a worker, another host or hosted CI.
