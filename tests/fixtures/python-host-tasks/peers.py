"""Installed consumers use only the public API. Private probes below audit its isolation."""
import asyncio
import ctypes
import os
import gc
import weakref
from pathlib import Path

import lean_bridge_host_runtime as runtime
import lean_meter as meter
import lean_meter_peer as peer


class Box:
    def __init__(self, n):
        self.n = n

    def read(self):
        return self.n


class Other(Box):
    pass


class Pin:
    def read(self):
        return 1


class Snapshot(ctypes.Structure):
    _fields_ = [(k, ctypes.c_uint32) for k in
                ("abi", "state", "init", "component_init", "attached", "live")] + [
                    ("runtime", ctypes.c_uint64), ("domain", ctypes.c_uint64)]


broker = ctypes.CDLL(str(Path(runtime.__file__).parent / "lib/liblean_bridge_native.so"),
                     mode=os.RTLD_NOLOAD | os.RTLD_NOW)
broker.lean_bridge_native_snapshot_read.argtypes = [ctypes.POINTER(Snapshot)]
broker.lean_bridge_native_runtime_retire.argtypes = []
broker.lean_bridge_native_runtime_retire.restype = None


def leases():
    s = Snapshot()
    broker.lean_bridge_native_snapshot_read(ctypes.byref(s))
    return s.live


def descriptors():
    result = {}
    for f in os.listdir("/proc/self/fd"):
        try:
            result[f] = os.readlink("/proc/self/fd/" + f)
        except FileNotFoundError:
            pass
    return result


async def settled():
    # An unsubscribed Lean completion may still own its notification lease
    # until the worker actually settles. Its asyncio descriptor must be gone now.
    async with asyncio.timeout(5):
        while leases():
            await asyncio.sleep(.005)


async def main():
    a, b = Box(3), Other(5)
    async with peer.bind_hosts(Box=Box, Pinned=Pin):
        baseline = descriptors()
        calls = []
        bad = Pin()
        invalid = weakref.ref(bad)
        try:
            await peer.pinned(bad, -1, lambda o: calls.append(o) or 1)
        except (OverflowError, ValueError, TypeError):
            pass
        else:
            raise AssertionError("negative UInt32 entered Lean")
        del bad
        await asyncio.sleep(0)
        gc.collect()
        assert not calls and invalid() is None, "rejected input acquired a strong lease"
        good = Pin()
        valid = weakref.ref(good)
        assert await peer.pinned(good, 4, lambda o: 1 if o is good else 0) == 5
        del good
        assert valid() is not None, "successful strong binding did not retain its input"
        try:
            with meter.bind_hosts(Box=Other):
                pass
        except TypeError as error:
            assert "incompatible binding" in str(error)
        else:
            raise AssertionError("independent packages did not share a nominal class table")
        async with meter.bind_hosts(Box=Box):
            assert await meter.relay(await peer.exchange(a, lambda _: b), lambda x: x) is b
            assert await peer.exchange(b, lambda x: a if meter.read_level(x) == 5 else x) is a
            # Keep a private old ticket around to test the native guard beneath asyncio.
            old = meter._native.outcome(b)
        assert await peer.exchange(a, lambda x: x) is a
        # Stop a callback before dispatch. Synchronous context exit must remove
        # both selector readers before the event loop gets another turn.
        loop = asyncio.get_running_loop()
        armed, add = asyncio.Event(), loop.add_reader
        called = []
        def park(fd, fn, *args):
            if getattr(fn, "__name__", None) == "pump":
                return add(fd, lambda: None)
            result = add(fd, fn, *args)
            if getattr(fn, "__name__", None) == "wake":
                armed.set()
            return result
        try:
            with meter.bind_hosts(Box=Box):
                loop.add_reader = park
                pending = asyncio.create_task(meter.relay(a, lambda x: called.append(x) or x))
                await asyncio.wait_for(armed.wait(), timeout=5)
        finally:
            loop.add_reader = add
        assert not called and descriptors() == baseline
        try:
            await pending
        except asyncio.CancelledError:
            pass
        else:
            raise AssertionError("disposed callback delivered a result")
        async with meter.bind_hosts(Box=Box):
            try:
                meter._native._task_take(old)
            except RuntimeError as error:
                assert "stale or foreign" in str(error)
            else:
                raise AssertionError("same class and same runtime revived an old task ticket")
            finally:
                meter._native._task_close(old)
            assert await meter.relay(b, lambda x: x) is b
            await settled()
            # A job reaches the callback port, then retirement wins before the
            # loop dispatches that callback. No polling or timeout drives the race.
            loop = asyncio.get_running_loop()
            add = loop.add_reader
            calls = []
            def retire_once(fd, fn, *args):
                result = add(fd, fn, *args)
                if getattr(fn, "__name__", None) == "pump":
                    loop.call_soon(broker.lean_bridge_native_runtime_retire)
                return result
            loop.add_reader = retire_once
            try:
                await meter.relay(a, lambda x: calls.append(x) or x)
            except RuntimeError as error:
                assert "runtime" in str(error)
            else:
                raise AssertionError("retired worker succeeded")
            finally:
                loop.add_reader = add
            assert not calls
            try:
                await peer.exchange(b, lambda x: x)
            except RuntimeError:
                pass
            else:
                raise AssertionError("peer reused a retired shared runtime")
    gc.collect()
    assert valid() is None and descriptors() == baseline
    await settled()
    print("Python worker: independent package identity, separate binding generations, shared retirement and zero live leases passed")


asyncio.run(main())
