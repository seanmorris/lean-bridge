"""Independent broker observer; installed application code needs none of this."""
import ctypes
import os
from pathlib import Path
import lean_bridge_host_runtime as runtime


class Snapshot(ctypes.Structure):
    _fields_ = [(n, ctypes.c_uint32) for n in ("abi", "state", "init", "components", "attached", "live")] + [
        ("runtime", ctypes.c_uint64), ("domain", ctypes.c_uint64)]


lib = ctypes.CDLL(str(Path(runtime.__file__).parent / "lib/liblean_bridge_native.so"), mode=os.RTLD_NOLOAD | os.RTLD_NOW)
lib.lean_bridge_native_snapshot_read.argtypes = [ctypes.POINTER(Snapshot)]
lib.lean_bridge_native_snapshot_read.restype = None
retire = lib.lean_bridge_native_runtime_retire
retire.argtypes, retire.restype = [], None


def snapshot():
    s = Snapshot()
    lib.lean_bridge_native_snapshot_read(ctypes.byref(s))
    return s


def _fds():
    for f in Path("/proc/self/fd").iterdir():
        try:
            yield os.readlink(f)
        except FileNotFoundError:
            pass


def descriptors():
    return sum(fd == "/dev/null" for fd in _fds())


def watch_descriptors():
    fds = list(_fds())
    return fds.count("anon_inode:[eventpoll]"), fds.count("anon_inode:[eventfd]")
