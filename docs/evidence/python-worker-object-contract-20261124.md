# Python object identity in a Lean worker contract

The [worker fixture](../../tests/fixtures/python-host-tasks/Workers.lean) passes a Python `Box` to a retained callback, accepts one back, returns one inside an `Except`, and uses one as a typed factory or cursor-step error. The independent synchronous `Workshop.readLevel` still calls the real imported Python method.

The [compiler check](../../tests/helpers/python-host-task-project.mjs) builds the Lake project on the ordinary and reviewed routes. The reviewed build has no export list: Lean Bridge must recover it from the review, compile the real source, and reconcile the two. The resulting interface has SHA-256 `5733e2747425680dffbe5117ce4c212dba3fe71af4a84c25030be8a991fcd562` on both routes.

The callback contract names the asyncio owner, requires a synchronous Python return value and preserves its nominal object type. A propagated callback has the `PythonCallbackException` failure channel; a synchronous imported method has `PythonHostException`. Both are distinct from a returned `Except` value or a Lean worker's own `IO.Error`. An indirect attempt to call a Python member in the Lean worker fails compilation. The same boundary is checked against compiled foreign calls, not just the exported function's type.

Run `npm run test:python-host-task-imports` with the repository's pinned Lean toolchain. This checks compiler and ownership metadata. It does not establish that an installed Python wheel delivers these objects through asyncio.
