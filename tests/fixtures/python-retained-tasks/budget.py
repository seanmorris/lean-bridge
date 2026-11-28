"""Ordinary downstream asyncio client of the installed Budget wheels."""
import asyncio
import ctypes
import gc
import os
import threading
from pathlib import Path

import lean_budget as api
import lean_bridge_host_runtime as runtime


async def catches(kind, operation):
    try:
        await operation
    except kind as error:
        return error
    raise AssertionError(f"expected {kind.__name__}")


async def checks():
    loop = asyncio.get_running_loop()
    owner = threading.get_ident()
    calls, nested = [], []

    def first(n):
        assert threading.get_ident() == owner
        calls.append(("once", n))
        nested.append(loop.create_task(api.single(40, lambda v: v + 2)))
        return n + 1

    def many(n):
        calls.append(("many", n))
        return n + 1

    denied = await catches(api.CallbackAlreadyInvoked, api.probe(0, first, many))
    assert str(denied) == "callback-already-invoked"
    assert calls == [("once", 0), ("many", 1), ("many", 2)]
    assert await asyncio.gather(*nested) == [42]

    for original in (ValueError(str(denied)), denied):
        attempts = []

        def throws(n):
            attempts.append(n)
            raise original

        assert await catches(type(original), api.single(19, throws)) is original
        retry = await catches(api.CallbackAlreadyInvoked, api.retry(20, throws))
        assert retry is not original and str(retry) == str(denied)
        assert attempts == [19, 20]

    visits = []

    def step(n):
        visits.append(n)
        return n + 1

    assert await api.pair(40, step, step) == 42 and visits == [40, 41]
    assert await asyncio.gather(api.single(41, step), api.single(41, step)) == [42, 42]
    assert visits == [40, 41, 41, 41]


asyncio.run(checks())
gc.collect()


class Snapshot(ctypes.Structure):
    _fields_ = [(name, ctypes.c_uint32) for name in
                ("abi", "state", "init", "component_init", "attached", "live")] + [
                    ("runtime", ctypes.c_uint64), ("domain", ctypes.c_uint64)]


# Observe the already-loaded broker; never load another copy to count leases.
lib = ctypes.CDLL(str(Path(runtime.__file__).parent / "lib/liblean_bridge_native.so"),
                  mode=os.RTLD_NOLOAD | os.RTLD_NOW)
lib.lean_bridge_native_snapshot_read.argtypes = [ctypes.POINTER(Snapshot)]
snapshot = Snapshot()
lib.lean_bridge_native_snapshot_read(ctypes.byref(snapshot))
assert snapshot.init == 1 and snapshot.live == 0
print("once 1; many 2; nested 42; original identity; caught retry denied; two slots; concurrent tasks; zero leases")
