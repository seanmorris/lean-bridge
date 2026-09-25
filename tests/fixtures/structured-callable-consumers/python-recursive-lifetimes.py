"""Retained recursive closures bind thread lifetimes and release finite slots."""
import concurrent.futures
import ctypes
import gc
import json
import threading
import weakref

import lean_structured as api
from lean_structured import _native as native

class Snapshot(ctypes.Structure):
    _fields_ = [(name, ctypes.c_uint32) for name in (
        'abi', 'state', 'runs', 'components', 'attached', 'identities'
    )] + [('runtime', ctypes.c_uint64), ('domain', ctypes.c_uint64)]

read_snapshot = native._GraphAssets._LIBRARY.lean_bridge_native_snapshot_read
read_snapshot.argtypes = [ctypes.POINTER(Snapshot)]
read_snapshot.restype = None

def live():
    snapshot = Snapshot()
    read_snapshot(ctypes.byref(snapshot))
    return snapshot.identities

value = api.TreeBranch((api.TreeLeaf(1 << 256),))
api.call_recursive(value, lambda item: item)
assert live() == 0

def create():
    closure = api.make_recursive(value)
    assert closure(True, api.TreeLeaf(0)) == value
    return closure, threading.get_ident()

with concurrent.futures.ThreadPoolExecutor(max_workers=1) as worker:
    closure, creator_ident = worker.submit(create).result()
assert live() == 1

def reject():
    try:
        closure(True, api.TreeLeaf(0))
    except RuntimeError as error:
        assert 'creating thread' in str(error)
    else:
        raise AssertionError('Closure outlived its creating thread lifetime')
    # A new closure created on this thread remains usable.
    with api.make_recursive(value) as local:
        assert local(True, api.TreeLeaf(0)) == value
    return threading.get_ident() == creator_ident

recycled = 0
for _ in range(16):
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as worker:
        recycled += worker.submit(reject).result()
assert live() == 1
closure.close()
closure.close()
assert live() == 0

# The 4,097th owned closure must fail without losing its capture or consuming
# a slot. Closing one makes exactly one replacement slot available.
held = [api.make_recursive(value) for _ in range(4096)]
assert live() == 4096
try:
    api.make_recursive(value)
except api.LeanBridgeError as error:
    assert error.status == 3
else:
    raise AssertionError('Closure identity capacity was not enforced')
assert live() == 4096
assert held[-1](True, api.TreeLeaf(0)) == value
held[0].close()
assert live() == 4095
with api.make_recursive(value) as replacement:
    assert live() == 4096
    assert replacement(True, api.TreeLeaf(0)) == value
assert live() == 4095
for closure in held:
    closure.close()
assert live() == 0

fallback = api.make_recursive(value)
lease = weakref.ref(fallback._lease)
assert live() == 1
del fallback
gc.collect()
assert lease() is None and live() == 0
assert api.call_recursive(value, lambda item: item) == value
print(json.dumps({'creatorExitRejections': 16, 'recycledThreadIds': recycled,
                  'capacity': 4096, 'overflowRejected': True,
                  'replacementUsable': True, 'finalizationReleased': True,
                  'identities': live()}))
