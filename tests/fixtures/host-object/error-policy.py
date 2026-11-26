"""Change one reply tag from the installed peer; do not call the broker's retirement API."""
import importlib
import json
import ctypes
import os
from pathlib import Path
import sys

names = sys.argv[1:]
assert sorted(names) == ["lean_workshop", "lean_workshop_peer"]
outer, peer = map(importlib.import_module, names)
seen = {"set": 0, "read": 0, "native": 0, "caught": 0}

class Snapshot(ctypes.Structure):
    _fields_ = [(k, ctypes.c_uint32) for k in
                ("abi", "state", "init", "component_init", "attached", "live")] + [
                    ("runtime", ctypes.c_uint64), ("domain", ctypes.c_uint64)]


# Observe the broker already loaded by the installed packages. The probe
# cannot change its state and must not load a second copy.
runtime = importlib.import_module("lean_bridge_host_runtime")
broker = ctypes.CDLL(str(Path(runtime.__file__).parent / "lib/liblean_bridge_native.so"),
                     mode=os.RTLD_NOLOAD | os.RTLD_NOW)
broker.lean_bridge_native_snapshot_read.argtypes = [ctypes.POINTER(Snapshot)]
broker.lean_bridge_native_snapshot_read.restype = None


def snapshot():
    snap = Snapshot()
    broker.lean_bridge_native_snapshot_read(ctypes.byref(snap))
    assert snap.abi == 1 and snap.init == 1
    return snap


class Box:
    @property
    def level(self):
        return 23

    @level.setter
    def level(self, value):
        seen["set"] += 1
        try:
            peer.choose(False, False, -3, "unused")
        except RuntimeError as exc:
            if "invalid native Lean result" not in str(exc):
                raise
            seen["caught"] += 1
            return
        # An old decoder treated 2 as true. Allow that path to finish so the
        # enclosing assertion can report the actual stale result (97).

    def read(self):
        seen["read"] += 1
        return 97


class Token:
    pass


def bind(api):
    return api.bind_hosts(Box=Box, Token=Token) if hasattr(api, "host_pair") else api.bind_hosts(Box=Box)


def unavailable(call):
    try:
        value = call()
    except RuntimeError:
        assert snapshot().state == 3, "host error without retirement"
    else:
        raise AssertionError(f"call falsely succeeded after a terminal fault: {value!r}, {seen}")


with bind(outer), bind(peer):
    assert snapshot().state == 2
    obj = Box()
    assert peer.choose(False, False, -3, "unused") == peer.Ok(peer.Ok(42))
    assert peer.choose(False, True, -3, "label") == peer.Ok(peer.Err("label"))
    try:
        peer.typed_choice(True, False, 23, "")
    except peer.LeanEIOError as exc:
        assert exc.payload == 23
    else:
        raise AssertionError("missing declared EIO failure")
    original = peer._native.choose

    def inconsistent(*args):
        pair = original(*args)
        assert pair == (True, (True, 42))
        seen["native"] += 1
        return (True, (2, pair[1][1]))

    peer._native.choose = inconsistent
    try:
        unavailable(lambda: outer.checked_set(obj, 19, "mapped"))
    finally:
        peer._native.choose = original
    unavailable(lambda: peer.read(obj))
    unavailable(lambda: outer.read(obj))
    assert seen == {"set": 1, "read": 0, "native": 1, "caught": 1}, seen
end = snapshot()
assert end.state == 3 and end.live == 0
print(json.dumps({"outer": names[0], "peer": names[1], **seen, "retired": True, "live": end.live}, sort_keys=True))
