"""Independent lifecycle observer of the installed runtime; not application glue."""
import asyncio
import ctypes
import gc
import os
from pathlib import Path
import select
import sys
import time

import lean_bridge_host_runtime as runtime
import lean_retained as api


class Snapshot(ctypes.Structure):
    _fields_ = [(n, ctypes.c_uint32) for n in
                ("abi", "state", "init", "component_init", "attached", "live")] + [
                    ("runtime", ctypes.c_uint64), ("domain", ctypes.c_uint64)]


api.reset()
lib = ctypes.CDLL(str(Path(runtime.__file__).parent / "lib/liblean_bridge_native.so"),
                  mode=os.RTLD_NOLOAD | os.RTLD_NOW)
lib.lean_bridge_native_snapshot_read.argtypes = [ctypes.POINTER(Snapshot)]
lib.lean_bridge_native_runtime_retire.argtypes = []
lib.lean_bridge_native_runtime_retire.restype = None


def leases():
    s = Snapshot()
    lib.lean_bridge_native_snapshot_read(ctypes.byref(s))
    return s.live


called = []


async def pending():
    loop = asyncio.get_running_loop()
    old = loop.add_reader
    ports = []
    def watch(fd, f, *args):
        if getattr(f, "__name__", None) == "pump":
            ports.append(fd)
        return old(fd, f, *args)
    loop.add_reader = watch
    try:
        job = asyncio.create_task(api.queued(lambda n: called.append(n) or n))
        while api.state() != 3:
            await asyncio.sleep(.002)
    finally:
        loop.add_reader = old
    assert len(ports) == 1 and leases() >= 2
    if sys.argv[1] == "shutdown":
        return job  # asyncio.run's own teardown must cancel it and revoke the port
    api.release()
    assert select.select(ports, [], [], 5)[0] == ports
    lib.lean_bridge_native_runtime_retire()
    try:
        await job
    except RuntimeError as e:
        assert "runtime" in str(e)
    else:
        raise AssertionError("retired runtime ran a queued Python callback")
    return job


assert leases() == 0
if sys.argv[1] == "shutdown":
    assert asyncio.run(pending()).cancelled()
    api.release()
    deadline = time.monotonic() + 5
    while api.state() == 3 and time.monotonic() < deadline:
        time.sleep(.01)
    assert api.state() == 4
else:
    asyncio.run(asyncio.wait_for(pending(), 12))
assert not called
gc.collect()
deadline = time.monotonic() + 5
while leases() and time.monotonic() < deadline:
    time.sleep(.01)
assert leases() == 0
print(sys.argv[1] + ": revoked callback never executed; broker leases returned to zero")
