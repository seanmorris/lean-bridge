"""Malformed installed output retires the shared runtime before later calls."""
import ctypes
import re
import lean_structured as api
from lean_structured import _native as native

entry_names = [name for name in api.call_recursive.__code__.co_names
               if re.fullmatch(r'_call\d+', name)]
assert len(entry_names) == 1
names = [name for name in getattr(native, entry_names[0]).__code__.co_names
         if re.fullmatch(r'_fn\d+', name)]
assert len(names) == 1
name = names[0]
original = getattr(native, name)

def malformed(_input, _callback, output):
    view = ctypes.cast(output, original.argtypes[-1]).contents
    view.kind = 2**32 - 1
    return 0

setattr(native, name, malformed)
try:
    api.call_recursive(api.TreeLeaf(0), lambda value: value)
except api.LeanBridgeError as failure:
    assert failure.status == 4, failure
else:
    raise AssertionError('Malformed native variant accepted')
finally:
    setattr(native, name, original)
try:
    api.call_array([], lambda value: value)
except api.LeanBridgeError as failure:
    assert failure.status == 5, failure
else:
    raise AssertionError('Retired runtime reentered')
print('malformed-output-retires-runtime')
