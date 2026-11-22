"""Independent observer of the installed broker; not application glue."""
import asyncio
import ctypes
import os
from pathlib import Path
import runpy
import select
import subprocess
import sys

import lean_bridge_host_runtime as runtime
import lean_timers as timers

timers.reset()
lib = ctypes.CDLL(str(Path(runtime.__file__).parent / "lib/liblean_bridge_native.so"),
                  mode=os.RTLD_NOLOAD | os.RTLD_NOW)


class Snapshot(ctypes.Structure):
    _fields_ = [(n, ctypes.c_uint32) for n in
                ("abi", "state", "init", "component_init", "attached", "live")] + [
                    ("runtime", ctypes.c_uint64), ("domain", ctypes.c_uint64)]


def leases():
    value = Snapshot()
    lib.lean_bridge_native_snapshot_read(ctypes.byref(value))
    return value.live


async def audit():
    assert leases() == 0
    timers.reset()
    loop = asyncio.get_running_loop()
    add_reader = loop.add_reader
    notified = []

    def settle_before_registration(fd, callback, *args):
        timers.release()
        assert select.select([fd], [], [], 8)[0] == [fd]
        notified.append(True)
        return add_reader(fd, callback, *args)

    loop.add_reader = settle_before_registration
    try:
        assert await timers.open_task(True, "raced") == timers.Ok("raced")
        assert notified == [True]
        assert await timers.immediate(1) == 2 and notified == [True]
    finally:
        loop.add_reader = add_reader
    assert leases() == 0
    timers.reset()
    job = asyncio.create_task(timers.open_task(False, "late"))
    async with asyncio.timeout(10):
        while timers.state() != 1:
            await asyncio.sleep(.005)
        assert leases() == 1
        job.cancel()
        try:
            await job
        except asyncio.CancelledError:
            pass
        assert job.cancelled() and leases() == 1
        timers.release()
        while leases():
            await asyncio.sleep(.005)
        assert timers.state() == 3


asyncio.run(audit())


async def stream_leases():
    assert leases() == 0
    stream = timers.series(1, 3, 10, False, False, False, "idle")
    assert leases() == 0
    assert await anext(stream) == timers.Ok(1)
    assert leases() == 1  # A live cursor, no prefetch.
    await stream.aclose()
    assert leases() == 0
    timers.reset()
    stream = timers.series(1, 3, 10, True, False, False, "late")
    nfd = len(os.listdir("/proc/self/fd"))
    pending = asyncio.create_task(anext(stream, "done"))
    async with asyncio.timeout(10):
        while timers.state() != 1:
            await asyncio.sleep(.005)
        assert leases() == 2 and len(os.listdir("/proc/self/fd")) == nfd + 1
        await stream.aclose()
        assert await pending == "done" and leases() == 1
        assert len(os.listdir("/proc/self/fd")) == nfd
        timers.release()
        while leases():
            await asyncio.sleep(.005)
        assert timers.state() == 3
    print("independent pull leases: idle 0/1/0; pending 0/2/1/0; descriptors restored")


asyncio.run(stream_leases())
runpy.run_path("streams.py", run_name="__main__")
runpy.run_path("consumer.py", run_name="__main__")
assert leases() == 0
child = subprocess.run([sys.executable, "-S", "-B", "consumer.py", "--exit-with-running-task"],
                       timeout=12, capture_output=True, text=True, check=True)
assert child.stdout.strip() == "exiting with uncancelled native work" and not child.stderr
print("independent broker: 0/1/1/0 leases and prompt process shutdown with late work")
