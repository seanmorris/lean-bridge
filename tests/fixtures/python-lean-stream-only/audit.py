"""Test-only fault injection. A retired runtime may release a cursor but not run it."""
import asyncio
import ctypes
import os
from pathlib import Path
import runpy

import lean_bridge_host_runtime as runtime
import lean_signals as signals

runpy.run_path("app.py", run_name="__main__")
broker = ctypes.CDLL(str(Path(runtime.__file__).parent / "lib/liblean_bridge_native.so"),
                     mode=os.RTLD_NOLOAD | os.RTLD_NOW)


class Snapshot(ctypes.Structure):
    _fields_ = [(n, ctypes.c_uint32) for n in
                ("abi", "state", "init", "component_init", "attached", "live")] + [
                    ("runtime", ctypes.c_uint64), ("domain", ctypes.c_uint64)]

broker.lean_bridge_native_snapshot_read.argtypes = [ctypes.POINTER(Snapshot)]
broker.lean_bridge_native_snapshot_read.restype = None
broker.lean_bridge_native_runtime_retire.argtypes = []
broker.lean_bridge_native_runtime_retire.restype = None


def state():
    snapshot = Snapshot()
    broker.lean_bridge_native_snapshot_read(ctypes.byref(snapshot))
    return snapshot.state, snapshot.live


async def retire():
    assert state() == (2, 0)
    stream = signals.constant(7)
    assert await anext(stream) == 7 and state() == (2, 1)
    broker.lean_bridge_native_runtime_retire()
    assert state() == (3, 1)
    for it in [stream, signals.constant(83)]:
        try:
            await anext(it)
        except RuntimeError:
            pass
        else:
            raise AssertionError("a retired runtime executed another pull")
        await it.aclose()
        assert state() == (3, 0)
    print("retired runtime: existing and new pulls refused, cursor lease released")


asyncio.run(retire())
