import ctypes
import os
import sys
import threading
from pathlib import Path
import lean_bridge_host_runtime as runtime
import lean_journal as api

# Test-only observer of the already loaded runtime; application calls need none of this.
class Snapshot(ctypes.Structure):
    _fields_ = [(n, ctypes.c_uint32) for n in ("abi", "state", "init", "components", "attached", "live")] + [
        ("runtime", ctypes.c_uint64), ("domain", ctypes.c_uint64)]


broker = ctypes.CDLL(str(Path(runtime.__file__).parent / "lib/liblean_bridge_native.so"),
                     mode=os.RTLD_NOW | os.RTLD_NOLOAD)


def snapshot():
    value = Snapshot()
    broker.lean_bridge_native_snapshot_read(ctypes.byref(value))
    assert value.abi == 1
    return value.components, value.live


assert "asyncio" not in sys.modules and not hasattr(api, "bind_hosts")
assert not any(n.startswith(("_task_", "_cursor_")) for n in dir(api._native))
cold = snapshot()
try:
    api.store("state", b"not text")
    raise AssertionError("cold invalid call accepted")
except TypeError:
    assert snapshot() == cold, "bad input initialized application modules"
worker_errors = []


def worker():
    try:
        api.bump(9)
    except RuntimeError as error:
        worker_errors.append(error)


thread = threading.Thread(target=worker)
thread.start()
thread.join()
assert len(worker_errors) == 1 and not isinstance(worker_errors[0], api.LeanIOError)
assert snapshot() == cold
assert api.count() == 0 and api.bump(3) == 3
warm = snapshot()
assert warm == (cold[0] + 1, cold[1])
for bad, error in [(-1, OverflowError), (True, TypeError)]:
    try:
        api.bump(bad)
        raise AssertionError("invalid input accepted")
    except error:
        assert api.count() == 3
assert api.bump(2) == 5 and api.echo(37) == 37
try:
    api.store("state", b"not text")
    raise AssertionError("invalid input accepted")
except TypeError:
    assert api.read("state") == "open"
try:
    api.read("missing")
    raise AssertionError("file read succeeded")
except api.LeanIOError as error:
    assert error.declaration == "Journal.read" and "missing" in error.message
for _ in range(4):
    for tag, payload in [(True, api.Ok("payload")), (False, api.Err(37))]:
        assert api.choose(False, tag, "payload") == payload
        try:
            api.choose(True, tag, "payload")
            raise AssertionError("declared EIO did not raise")
        except api.LeanEIOError as error:
            assert error.declaration == "Journal.choose" and error.payload == payload
assert api.store("state", "closed") is None and api.read("state") == "closed"
assert snapshot() == warm
child = os.fork()
if not child:
    try:
        api.count()
    except RuntimeError as error:
        os._exit(0 if not isinstance(error, api.LeanIOError) else 2)
    os._exit(1)
assert os.waitpid(child, 0)[1] == 0 and api.count() == 5
assert "asyncio" not in sys.modules
