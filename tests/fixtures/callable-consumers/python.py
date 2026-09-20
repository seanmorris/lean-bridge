"""Independent installed-wheel acceptance. No Lean or C compiler is available."""
import concurrent.futures
import copy
import ctypes
import gc
import math
import os
import pickle
import signal
import sys
import threading
import typing
import weakref
import warnings

import lean_callables as api
from lean_callables import _native as native

checks = 0


def check(condition):
    global checks
    checks += 1
    if not condition:
        raise AssertionError(f"check {checks} failed")


def same(actual, expected):
    check(type(actual) is type(expected))
    if type(expected) is float:
        check(math.isnan(actual) if math.isnan(expected) else actual == expected)
        if not math.isnan(expected):
            check(math.copysign(1, actual) == math.copysign(1, expected))
    else:
        check(actual == expected)


def rejects(kind, call):
    try:
        call()
    except kind as failure:
        check(True)
        return failure
    raise AssertionError(f"Expected {kind}")


class Snapshot(ctypes.Structure):
    _fields_ = [(name, ctypes.c_uint32) for name in (
        "abi", "state", "runs", "components", "attached", "identities"
    )] + [("runtime", ctypes.c_uint64), ("domain", ctypes.c_uint64)]


read_snapshot = native._LIBRARY.lean_bridge_native_snapshot_read
read_snapshot.argtypes = [ctypes.POINTER(Snapshot)]
read_snapshot.restype = None


def live():
    snapshot = Snapshot()
    read_snapshot(ctypes.byref(snapshot))
    return snapshot.identities


check(api.word_bits() == 64)
baseline = live()
huge = (1 << 5120) + (1 << 255) + 17
cases = {
    "unit": [None],
    "bool": [False, True],
    "nat": [0, 1, 2**31, 2**32, 2**53 - 1, 2**53 + 1, 2**64, huge],
    "int": [0, -1, 2**31, -(2**32), 2**53 + 1, -(2**64), huge, -huge],
    "float32": [0.0, -0.0, 1.25, -1.25, 1 / 3, 2**-149, -2**-149,
                float("inf"), -float("inf"), float("nan"), 1e300],
    "float": [0.0, -0.0, 1 / 3, -1.25, 2**-1074, -2**-1074,
              float("inf"), -float("inf"), float("nan")],
    "string": ["", "a\0λ🌿", "\0", "\U0010ffff", "e\u0301"],
    "bytes": [b"", b"\0\xff\x80", bytes(range(256))],
    "char": ["\0", "\x7f", "\ud7ff", "\ue000", "\uffff", "\U00010000", "🌿", "\U0010ffff"],
}
for bits in (8, 16, 32, 64):
    cases[f"uint{bits}"] = [0, 1, 2**bits - 1]
    cases[f"int{bits}"] = [-(2**(bits - 1)), -1, 0, 2**(bits - 1) - 1]
cases["uint64"] += [2**31, 2**32, 2**53 - 1, 2**53 + 1]
cases["int64"] += [2**31, -(2**32), 2**53 + 1]
cases["usize"] = cases["uint64"]
cases["isize"] = cases["int64"]
check(len(cases) == 19)

for name, values in cases.items():
    call = getattr(api, "call_" + name)
    twice = getattr(api, "twice_" + name)
    make = getattr(api, "make_" + name)
    normalize = (lambda x: ctypes.c_float(x).value) if name == "float32" else (lambda x: x)
    for index in range(128):
        value = values[index % len(values)]
        other = values[(index + 1) % len(values)]
        expected, replacement = normalize(value), normalize(other)
        seen = []

        def callback(item):
            same(item, expected)
            seen.append(item)
            return other

        same(call(value, callback), replacement)
        check(len(seen) == 1)
        seen.clear()

        def alternating(item):
            same(item, expected if not seen else replacement)
            seen.append(item)
            return other if len(seen) == 1 else value

        same(twice(value, alternating), expected)
        check(len(seen) == 2)
        with make(value) as closure:
            check(isinstance(closure, api.LeanClosure) and not closure.closed)
            same(closure(True, other), expected)
            same(closure(False, other), replacement)
        check(closure.closed)
        closure.close()
        rejects(RuntimeError, lambda: closure(True, other))
    check(live() == baseline)

invalid = {
    "unit": [0, False], "bool": [0, None], "nat": [-1, True, 1.0],
    "int": [True, 1.0], "float": [1, True], "float32": [1, True],
    "string": [b"text", None, "\ud800"], "bytes": ["text", bytearray(b"x")],
    "char": ["", "ab", "\ud800", "\udfff", 65],
}
for bits in (8, 16, 32, 64):
    invalid[f"uint{bits}"] = [-1, 2**bits, True, 1.0]
    invalid[f"int{bits}"] = [-(2**(bits - 1)) - 1, 2**(bits - 1), True, 1.0]
invalid["usize"] = invalid["uint64"]
invalid["isize"] = invalid["int64"]
for name, bad_values in invalid.items():
    call, make = getattr(api, "call_" + name), getattr(api, "make_" + name)
    value = cases[name][0]
    for bad in bad_values:
        hits = []
        rejects((TypeError, ValueError), lambda: call(bad, lambda item: hits.append(item)))
        check(not hits)
        rejects((TypeError, ValueError), lambda: call(value, lambda _: bad))
        with make(value) as closure:
            rejects((TypeError, ValueError), lambda: closure(False, bad))
        check(live() == baseline)


class Marker(BaseException):
    pass


for name, values in cases.items():
    marker = Marker("original\0λ")
    calls = []

    def fail(value):
        calls.append(value)
        raise marker

    twice, call = getattr(api, "twice_" + name), getattr(api, "call_" + name)
    failure = rejects(Marker, lambda: twice(values[0], fail))
    check(failure is marker and len(calls) == 1)
    same(call(values[0], lambda value: value), values[0])
    check(live() == baseline)

rejects(TypeError, lambda: api.call_uint32(1, 4))


async def async_callback(value):
    return value


rejects(TypeError, lambda: api.call_uint32(1, async_callback))
rejects(TypeError, lambda: api.call_uint32(1, lambda value: async_callback(value)))

# Multiple parameters and separate callback contexts must not alias.
check(api.combine("hello\0", 2**64 - 1, lambda text, n: text + str(n),
                  lambda text: text + "🌿") == "hello\0" + "18446744073709551615🌿")
hits = []
marker = Marker("nested")


def fail_first(text, number):
    raise marker


check(rejects(Marker, lambda: api.combine("", 1, fail_first, lambda v: hits.append(v))) is marker)
check(not hits)


def nested(value):
    check(rejects(Marker, lambda: api.call_uint32(value, lambda _: fail_first("", 0))) is marker)
    return api.call_uint32(value, lambda n: n + 1)


check(api.twice_uint32(40, nested) == 42)
with api.make_uint32(42) as choose:
    check(api.call_uint32(0, lambda value: choose(True, value)) == 42)
sys.setrecursionlimit(4000)


def recurse(value):
    return api.call_uint32(value, recurse)


check("64" in str(rejects(api.LeanBridgeError, lambda: api.call_uint32(1, recurse))))
check(api.call_uint32(41, lambda value: value + 1) == 42)
for _ in range(8):
    escaped = api.retain_callback(lambda value: value + 1)
    rejects(api.LeanBridgeError, lambda: escaped(41))
    check(api.call_uint32(41, lambda value: value + 1) == 42)
    rejects(api.LeanBridgeError, lambda: escaped(41))
    escaped.close()
check(live() == baseline)

# Callback objects and temporary buffers are held for the call, then released.
class Identity:
    def __call__(self, value):
        gc.collect()
        return value


identity = Identity()
reference = weakref.ref(identity)
same(api.call_string("held\0🌿", identity), "held\0🌿")
del identity
gc.collect()
check(reference() is None)
rejects(ValueError, lambda: api.call_bytes(b"", lambda _: b"x" * (16 * 1024 * 1024 + 1)))
rejects(ValueError, lambda: api.call_string("x" * (16 * 1024 * 1024), lambda x: x))
rejects(ValueError, lambda: api.twice_string("x" * 1_500_000, lambda x: x))
check(api.call_bytes(b"ok", lambda value: value) == b"ok")

# Hooks inject Python allocation/result failures after native ownership exists.
allocations = []
original_allocate = native._Scope.allocate


def fail_allocate(scope, *args):
    value = original_allocate(scope, *args)
    allocations.append(weakref.ref(value))
    raise MemoryError("injected allocation failure")


native._Scope.allocate = fail_allocate
rejects(MemoryError, lambda: api.call_string("", lambda _: "owned"))
native._Scope.allocate = original_allocate
gc.collect()
check(all(reference() is None for reference in allocations))
original_lease = native._Lease


def fail_lease(*args):
    raise MemoryError("injected wrapper allocation failure")


native._Lease = fail_lease
rejects(MemoryError, lambda: api.make_string("captured\0🌿"))
native._Lease = original_lease
check(live() == baseline)

# A failure after wrapping must not double-free the native closure pointer.
wrappers = {name: getattr(native, name) for name in dir(native) if name.startswith("_own") and name[4:].isdigit()}


def fail_after_wrap(original):
    def failing(output):
        result = original(output)
        check(not result.closed)
        raise MemoryError("injected failure after ownership transfer")
    return failing


for name, original in wrappers.items():
    setattr(native, name, fail_after_wrap(original))
rejects(MemoryError, lambda: api.make_string("captured\0🌿"))
for name, original in wrappers.items():
    setattr(native, name, original)
gc.collect()
check(live() == baseline)

# Deferring close while an invocation owns the lease prevents early disposal.
closure = api.make_string("captured\0🌿")
original_invoke = closure._lease.invoke


def close_during_call(*args):
    closure.close()
    check(live() == baseline + 1)
    return original_invoke(*args)


closure._lease.invoke = close_during_call
check(closure(True, "input") == "captured\0🌿")
check(closure.closed and live() == baseline)

closure = api.make_uint32(42)
for operation in (copy.copy, copy.deepcopy, pickle.dumps):
    rejects(TypeError, lambda: operation(closure))
rejects(TypeError, api.LeanClosure)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as workers:
    check("creating thread" in str(workers.submit(lambda: rejects(RuntimeError, lambda: closure(True, 0))).result()))
closure.close()


def thread_calls(_):
    for _ in range(64):
        with api.make_unit(None) as unit:
            check(unit(True, None) is None)
        with api.make_uint64(2**64 - 1) as result:
            check(result(True, 0) == 2**64 - 1)
        check(api.call_nat(huge, lambda v: v + 1) == huge + 1)
    return True


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as workers:
    check(all(workers.map(thread_calls, range(8))))
check(live() == baseline)

# Closing on another thread waits for the active invocation to release its lock.
started, closing = threading.Event(), threading.Event()
closure = api.make_uint32(42)
original_invoke = closure._lease.invoke


def wait_for_close(*args):
    started.set()
    check(closing.wait(10))
    return original_invoke(*args)


def concurrent_close():
    check(started.wait(10))
    closing.set()
    closure.close()


closure._lease.invoke = wait_for_close
worker = threading.Thread(target=concurrent_close)
worker.start()
check(closure(True, 0) == 42)
worker.join(10)
check(not worker.is_alive() and closure.closed and live() == baseline)
closure = api.make_unit(None)
reference = weakref.ref(closure)
del closure
gc.collect()
check(reference() is None and live() == baseline)

# The fixed native registry must recover after exhaustion and garbage collection.
closures = [api.make_unit(None) for _ in range(4096)]
check(live() == baseline + 4096)
rejects(api.LeanBridgeError, lambda: api.make_unit(None))
for closure in closures:
    closure.close()
closures.clear()
check(live() == baseline)
with api.make_unit(None) as closure:
    check(closure(True, None) is None)

# Deliberately fork with inherited locks held. The child must reject every call
# before acquiring a lock. CPython 3.12+ warns about this unsupported operation.
closure = api.make_uint32(42)
locked, release = threading.Event(), threading.Event()


def hold_fork_locks():
    with native._state.lock, closure._lease.lock:
        locked.set()
        check(release.wait(10))


worker = threading.Thread(target=hold_fork_locks)
worker.start()
check(locked.wait(10))
try:
    with warnings.catch_warnings(record=True) as fork_warnings:
        warnings.simplefilter("always")
        child = os.fork()
finally:
    release.set()
if child == 0:
    signal.alarm(5)
    try:
        rejects(RuntimeError, lambda: closure(True, 0))
        rejects(RuntimeError, closure.close)
        rejects(RuntimeError, api.word_bits)
    except BaseException:
        os._exit(1)
    os._exit(0)
worker.join(10)
check(not worker.is_alive())
check(os.waitpid(child, 0)[1] == 0)
check(len(fork_warnings) == (1 if sys.version_info >= (3, 12) else 0))
for warning in fork_warnings:
    check(warning.category is DeprecationWarning)
    check(str(warning.message) == (
        f"This process (pid={os.getpid()}) is multi-threaded, "
        "use of fork() may lead to deadlocks in the child."
    ))
check(closure(True, 0) == 42)
closure.close()

for name in api.__all__:
    if name not in ("LeanBridgeError", "LeanClosure"):
        check(bool(typing.get_type_hints(getattr(api, name))))
check(typing.get_origin(typing.get_type_hints(api.make_nat)["return"]) is api.LeanClosure)
check(live() == baseline)
print(f"callable-python-ok:{checks}")
