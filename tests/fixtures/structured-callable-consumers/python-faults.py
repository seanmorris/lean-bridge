"""Private installed adapter probes; no on-disk package file is modified."""
import ctypes
import gc
import json
import re
import runpy
import weakref

import lean_structured as api
from lean_structured import _native as native

values = runpy.run_path("python-values.py")
SHAPES, payload, owned = (values[name] for name in ("SHAPES", "payload", "owned"))
checks = clears = closes = faults = 0


def check(condition):
    global checks
    checks += 1
    if not condition:
        raise AssertionError(f"fault check {checks} failed")


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


class Marker(BaseException):
    pass


def exercise(function, expected, fail_at=None, exception=MemoryError):
    global faults
    baseline = live()
    owners, scopes = [], []
    replacements = {}
    checkpoints = 0
    marker = exception("structured checkpoint failure")
    allocate, close = native._Scope.allocate, native._Scope.close
    failed = False

    def tick():
        nonlocal checkpoints
        current = checkpoints
        checkpoints += 1
        if current == fail_at:
            raise marker

    def track_allocate(scope, element, count):
        tick()
        memory = allocate(scope, element, count)
        owners.append(weakref.ref(memory))
        tick()
        return memory

    def track_close(scope):
        global closes
        close(scope)
        check(not scope.owners and scope.failure is None)
        scopes.append(weakref.ref(scope))
        closes += 1

    def checkpoint(original):
        def wrapped(*args):
            tick()
            result = original(*args)
            tick()
            return result
        return wrapped

    def track_clear(original):
        def wrapped(pointer):
            global clears
            original(pointer)
            target = ctypes.cast(pointer, original.argtypes[0]).contents
            check(ctypes.string_at(ctypes.addressof(target), ctypes.sizeof(target)) == bytes(ctypes.sizeof(target)))
            clears += 1
        return wrapped

    for name, original in list(vars(native).items()):
        if re.fullmatch(r"_(?:to|from|own)\d+", name):
            replacements[name] = original
            setattr(native, name, checkpoint(original))
        elif re.fullmatch(r"_(?:clear|dispose)\d+", name):
            replacements[name] = original
            setattr(native, name, track_clear(original))
    native._Scope.allocate = track_allocate
    native._Scope.close = track_close
    try:
        check(function() == expected)
    except exception as failure:
        check(failure is marker)
        failure.__traceback__ = None
        failed = True
        faults += 1
    finally:
        native._Scope.allocate = allocate
        native._Scope.close = close
        for name, original in replacements.items():
            setattr(native, name, original)
    gc.collect()
    check(failed == (fail_at is not None))
    check(live() == baseline)
    check(bool(scopes) and all(scope() is None for scope in scopes))
    check(all(owner() is None for owner in owners))
    return checkpoints


api.call_option(None, lambda item: item)
baseline = live()
reports = []
for shape in SHAPES:
    # Present nested options and heap-backed payloads exercise actual conversions.
    value = payload(shape, 2 if shape == "option" else 1)
    other = payload(shape, 6 if shape == "variant" else 2)
    expected = owned(other)
    call, twice, make = (getattr(api, action + "_" + shape) for action in ("call", "twice", "make"))

    def create():
        with make(other):
            return expected

    def create_call():
        with make(other) as closure:
            return closure(True, value)

    with make(other) as held:
        paths = {
            "callback": lambda: call(value, lambda _: other),
            "repeated": lambda: twice(value, lambda _: other),
            "create": create,
            "create-call": create_call,
            "held-call": lambda: held(True, value),
        }
        shape_faults, path_counts = 0, {}
        for name, function in paths.items():
            count = exercise(function, expected)
            check(count > 0)
            path_counts[name] = count
            for exception in (MemoryError, Marker):
                for limit in range(count):
                    exercise(function, expected, limit, exception)
                    shape_faults += 1
                    check(call(value, lambda _: other) == expected)
            check(exercise(function, expected) == count)
        reports.append({"shape": shape, "paths": path_counts, "faults": shape_faults})
    check(live() == baseline)

    # Reentrant close cannot free a closure while its invocation uses the handle.
    closure = make(value)
    invoke = closure._lease.invoke

    def close_during_call(*args):
        closure.close()
        check(live() == baseline + 1)
        return invoke(*args)

    closure._lease.invoke = close_during_call
    check(closure(True, other) == owned(value))
    check(closure.closed and live() == baseline)

# Decode invalid outer and nested tags without entering unsafe native code.
malformed = 0


def invalid(function, value, exception=api.LeanBridgeError):
    global malformed
    scope = native._Scope()
    try:
        function(value, scope)
    except exception:
        malformed += 1
    else:
        raise AssertionError("Malformed native value was accepted")
    finally:
        scope.close()


for name, value_type in list(vars(native).items()):
    if not re.fullmatch(r"_T\d+", name):
        continue
    decode = getattr(native, "_from" + name[2:])
    fields = dict(value_type._fields_)
    if "has_value" in fields:
        invalid(decode, value_type(has_value=2))
    elif "is_ok" in fields:
        invalid(decode, value_type(is_ok=2))
    elif "kind" in fields:
        invalid(decode, value_type(kind=2**32 - 1))
    elif "data" in fields:
        invalid(decode, value_type(data=None, length=1))
        invalid(decode, value_type(data=1, length=1 << 40), ValueError)

check(malformed >= 10)
check(live() == baseline)
check(faults == sum(report["faults"] for report in reports))
print(json.dumps({"checks": checks, "faults": faults, "clears": clears,
                  "closes": closes, "malformed": malformed, "shapes": reports}, sort_keys=True))
