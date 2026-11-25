# Returned Lean closures over Python application objects

The [Lean factory](../../tests/fixtures/python-host-closures/Closures.lean)
returns a function that captures the caller's Python object and invokes its
method later. This is the opposite direction from passing a Python callback
to Lean. The [downstream client](../../tests/fixtures/python-host-closures/consumer.py)
uses the installed wheel's normal methods, context managers and exceptions.
It never exchanges a native handle.

On CPython 3.11, four offline wheel installs passed after relocation. With two
distinct boxes, the returned closure delivered its original captured object.
A nested call preserved identity and a failing method raised its original
Python exception. Closing a closure inside its own invocation revoked new
calls without interrupting the original call. Trying to close the entire
binding from a running method was refused without invalidating the binding.
Weak references confirmed the box was released on close or binding exit.
Garbage-collecting a ticket on a foreign thread deferred cleanup until the
owner's next call.

An unrelated context could neither call nor close the function, nor run the
factory's first host method. Rebinding did not revive a stale closure or a
copied context. These checks distinguish a scalar-only worker next to host
functions from a worker that carries an application object and needs its
asyncio owner. In both worker builds another returned function read two
different file contents on successive invocations. With no filesystem grant
the publisher refused that function, even though its factory performs no IO.

| CPython 3.11 build | Verified package-set receipt (SHA-256) |
| --- | --- |
| Synchronous host, ordinary source | `08df1254e2e6b82d96303b231dbdcaa255b370cdb6a313f39fb5150dab683dbc` |
| Synchronous host, reviewed interface instead of export list | `6579797032215adc026efd973259edeac24096792413ba7d6e1547f3698cb417` |
| Host with binding-independent scalar task | `895673e9d155f4dda27ee6c63096dc646974041119ebbe9e1afd76ca12715197` |
| Host with application-object task | `95c6dd0d65bb9883b35bc69a6b2c006573433851f27e5e6bfce5ea8c27148018` |

Run `npm run test:python-host-closures` with the pinned Lean toolchain, a C
compiler and CPython with pip and development headers. Set `LEAN_BRIDGE_PYTHON`
to select an interpreter. The test verifies both wheels in each package set,
installs them with `pip --no-index`, and runs the client without compilers on
its path. This result covers unary `IO` closures with copied scalar or imported
Python-class arguments and replies, not another host's closure ABI.
