# C11 records retain application-created objects

The [C application](../../tests/fixtures/c-host-record/consumer.c) creates two meters with
different addresses and destructors. It passes them into the compiled Lean constructor,
calls methods through a pair of records, and calls a returned function after dropping its
input record. The returned record holds the original application objects, not copies of
their data. Once the binding closes, a getter still grants a new, independent lease.
Dropping the last record and that lease runs each meter's destructor exactly once.
Bytes and a 131-bit natural number, by contrast, are copied.

Three failure cases distinguish the guarantees:

- A stale second record is refused before the first application's read method runs.
- A failing read returns the original C host error code (173). The next call on the
  same binding succeeds.
- Lean returns two 9 MiB buffers with a meter between them. Converting the second
  buffer exceeds the aggregate output budget. The caller receives a limit status
  and no partial record. Dropping the original meter runs its destructor immediately:
  the failed call kept no export lease. The existing closure still works.

| Authoring route | Package receipt | Installed consumer runs |
| --- | --- | --- |
| Ordinary Lean source | [Archive](c-host-record-20261126/ordinary.package-set.json) | [pkg-config and CMake](c-host-record-20261126/ordinary.execution.json) |
| Edited, reviewed interface | [Archive](c-host-record-20261126/reviewed.package-set.json) | [pkg-config and CMake](c-host-record-20261126/reviewed.execution.json) |

The [producer and consumer check](../../tests/helpers/c-host-record-installed.mjs) installs
the packed authoring CLI, compiles the [Gauge declarations](../../tests/fixtures/dotnet-host-record/Workshop.lean)
with the C host import, verifies the package-set receipt and relocates the install.
The edited field documentation survives review; a reordered field list is rejected.
The C compiler also rejects a box passed where a pair is required. Each consumer
runs without a compiler on its search path and after the author project and release
directory are removed.

Run `npm run test:c-host-records` on a configured Linux x86-64 producer.
Set `LEAN_BRIDGE_CMAKE` if CMake is not on `PATH`. These runs cover flat records
on synchronous IO calls, not record-valued EIO failures, callbacks, or stream items.
