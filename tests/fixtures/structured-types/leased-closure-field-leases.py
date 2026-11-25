"""Inspect the runtime actually loaded by the public consumer, without GC."""
import ctypes as c
import runpy
import lean_tariff_quotes as api
from lean_tariff_quotes import _assets


class Snapshot(c.Structure):
    _fields_ = [(key, c.c_uint32) for key in (
        "abi", "state", "inits", "component_inits", "components", "identities"
    )] + [("instance", c.c_uint64), ("domain", c.c_uint64)]


read = _assets._LIBRARY.lean_bridge_native_snapshot_read
read.argtypes = [c.POINTER(Snapshot)]
read.restype = None


def live():
    snapshot = Snapshot()
    read(c.byref(snapshot))
    return snapshot.identities


assert live() == 0
state = api._OwnedNative._runtime.current_state()
assert live() == 1 and not state.slots
client = runpy.run_path("consumer.py", run_name="__main__")
assert client["copy"].is_closed and client["projected"].is_closed
# The client globals still hold the wrappers. The session is the only owner.
assert not state.slots, len(state.slots)
assert live() == 1, live()
state.close()
assert live() == 0, live()
