# Python object identity in a Lean worker contract

The [worker fixture](../../tests/fixtures/python-host-tasks/Workers.lean) passes a Python `Box` to a retained callback, accepts one back, returns one inside an `Except`, and uses one as a typed factory or cursor-step error. The independent synchronous `Workshop.readLevel` still calls the real imported Python method.

At [the compiler milestone](https://github.com/seanmorris/lean-bridge/commit/1cef0f808886ea15136a68a70a7976ee0415e010), the ordinary and reviewed builds produced identical interface bytes (SHA-256 `5733e2747425680dffbe5117ce4c212dba3fe71af4a84c25030be8a991fcd562`). The reviewed build had no export list: Lean Bridge recovered it from the review, compiled the real source, and reconciled the two. The current fixture adds a callback recovery branch and an IO-failing cursor.

The callback contract names the asyncio owner, requires a synchronous Python return value and preserves its nominal object type. A propagated callback has the `PythonCallbackException` failure channel; a synchronous imported method has `PythonHostException`. Both are distinct from a returned `Except` value or a Lean worker's own `IO.Error`. An indirect attempt to call a Python member in the Lean worker fails compilation. The same boundary is checked against compiled foreign calls, not just the exported function's type.

The [installed-wheel record](python-worker-wheels-20261124.md) covers the next step: actual Python object delivery and shutdown in independent consumer processes.

Run `npm run test:python-host-task-imports` with the pinned Lean toolchain for the compiler controls alone. To build wheels with the CLI, verify their receipts and run the relocated [consumer](../../tests/fixtures/python-host-tasks/consumer.py) and [two-package lifecycle checks](../../tests/fixtures/python-host-tasks/peers.py), set `LEAN_BRIDGE_PYTHON` to an absolute CPython 3.11 or 3.12 executable with pip and run `npm run test:python-host-workers`. The installed test removes both author trees before installing and runs Python in isolated mode with no author tools on PATH.
