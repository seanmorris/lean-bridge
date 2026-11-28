"""Test-only observer. The application in tariff-incoming.py uses no broker API."""
import ctypes
import json
import runpy


def observe(client, runtime, library):
    class Snapshot(ctypes.Structure):
        _fields_ = [(name, ctypes.c_uint32) for name in
                    ("abi", "state", "starts", "inits", "components", "live")] + [
                        ("instance", ctypes.c_uint64), ("domain", ctypes.c_uint64)]

    read = library.lean_bridge_native_snapshot_read
    read.argtypes, read.restype = [ctypes.POINTER(Snapshot)], None
    def count():
        value = Snapshot()
        read(ctypes.byref(value))
        assert value.abi == 1
        return value.live

    assert count() == 0
    state = runtime.current_state()
    assert count() == 1
    counts = []
    def checkpoint():
        assert not state.slots and count() == 1
        counts.append(count())

    runpy.run_path(client)["check"](checkpoint)
    state.close()
    counts.append(count())
    assert counts == [1, 1, 1, 1, 1, 1, 0]
    print(json.dumps(counts))
