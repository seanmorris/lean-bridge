"""Private installed-adapter failure probes, separate from the public caller."""
import ctypes
import gc
import json
import re
import sys
import weakref

import lean_collections as api
from lean_collections import _native as native

checks = allocation_failures = conversion_failures = clears = partial_inputs = malformed = 0


def check(value):
    global checks
    checks += 1
    assert value


def checked_call(function, value, fail_at=None, decode=False):
    conversions = closed = 0
    owners = []
    replacements = {}
    original_allocate = native._Scope.allocate
    original_close = native._Scope.close

    def tick():
        nonlocal conversions
        current = conversions
        conversions += 1
        if current == fail_at:
            raise MemoryError("injected copied conversion failure")

    def allocate(scope, element, count):
        if not decode:
            tick()
        memory = original_allocate(scope, element, count)
        owners.append(weakref.ref(memory))
        return memory

    def close(scope):
        nonlocal closed
        original_close(scope)
        check(scope.owners == [] and scope.failure is None)
        closed += 1

    def decoder(original):
        def wrapped(value, scope):
            tick()
            return original(value, scope)
        return wrapped

    def clear(original):
        def wrapped(pointer):
            global clears
            original(pointer)
            target = ctypes.cast(pointer, original.argtypes[0]).contents
            check(ctypes.string_at(ctypes.addressof(target), ctypes.sizeof(target)) == bytes(ctypes.sizeof(target)))
            clears += 1
        return wrapped

    for name, original in list(vars(native).items()):
        if re.fullmatch(r"_clear\d+", name):
            replacements[name] = original
            setattr(native, name, clear(original))
        elif decode and re.fullmatch(r"_from\d+", name):
            replacements[name] = original
            setattr(native, name, decoder(original))
    native._Scope.allocate = allocate
    native._Scope.close = close
    failed = False
    try:
        function(value)
    except MemoryError as error:
        check(str(error) == "injected copied conversion failure")
        failed = True
    finally:
        native._Scope.allocate = original_allocate
        native._Scope.close = original_close
        for name, original in replacements.items():
            setattr(native, name, original)
    gc.collect()
    check(closed == 1)
    check(all(owner() is None for owner in owners))
    check(failed == (fail_at is not None))
    return conversions


scalar = api.Primitives(None, True, 255, 65535, 19, (1 << 64) - 1, -7, -13, -19, -(1 << 63),
                        (1 << 5120) + 19, -((1 << 5120) + 31), 1.5, -2.25, "A\0🌱", b"\0\xff", "🌱", 19, -19)
packet = api.Packet("parcel\0", [[scalar], [], [scalar, scalar]], api.Empty(), api.Single(7),
                    api.Count(1 << 5120), api.Pair(11, "p"), api.Reversed("r", 13))
deep = 42
for _ in range(24):
    deep = [deep]
cases = [(api.record_shuffle, packet), (api.record_duplicate, packet), (api.record_reverse, [scalar, scalar]),
         (api.array_reverse_bytes, [[b"a", b"b"], [], [b"\0\xff"]]), (api.deep, deep)]
for function, argument in cases:
    for decode in (False, True):
        count = checked_call(function, argument, decode=decode)
        check(count > 0)
        for limit in range(count):
            checked_call(function, argument, fail_at=limit, decode=decode)
            if decode:
                conversion_failures += 1
            else:
                allocation_failures += 1
            check(api.record_count(api.Count(7)) == api.Count(8))
        checked_call(function, argument, decode=decode)

# Reject partially converted rows and release all owners, including prior good rows.
original_allocate = native._Scope.allocate
for count in range(64):
    owners = []

    def tracked(scope, element, size):
        value = original_allocate(scope, element, size)
        owners.append(weakref.ref(value))
        return value

    native._Scope.allocate = tracked
    try:
        api.array_reverse_bytes([[b"good\0"]] * count + [[b"good", "wrong"]])
    except TypeError:
        partial_inputs += 1
    else:
        raise AssertionError("partial invalid row was accepted")
    finally:
        native._Scope.allocate = original_allocate
    gc.collect()
    check(all(owner() is None for owner in owners))
    check(api.array_reverse_bytes([[b"good"]]) == ((b"good",),))

layout = json.loads(sys.argv[1])


def invalid(index, value, exception):
    global malformed
    scope = native._Scope()
    try:
        getattr(native, "_from" + str(index))(value, scope)
    except exception:
        malformed += 1
    else:
        raise AssertionError("malformed native value was accepted")
    finally:
        scope.close()


sequence = getattr(native, "_T" + str(layout["sequence"]))
invalid(layout["sequence"], sequence(None, 1, None, None), api.LeanBridgeError)
invalid(layout["sequence"], sequence(1, 1 << 40, None, None), ValueError)
backing = (ctypes.c_uint32 * 4)()
invalid(layout["sequence"], sequence(ctypes.addressof(backing) + 1, 1, None, None), api.LeanBridgeError)
text = getattr(native, "_T" + str(layout["string"]))
invalid(layout["string"], text(None, 1, None, None), api.LeanBridgeError)
bad_utf8 = ctypes.create_string_buffer(b"\xff")
invalid(layout["string"], text(ctypes.addressof(bad_utf8), 1, None, None), UnicodeDecodeError)
invalid(layout["char"], 0x110000, api.LeanBridgeError)
invalid(layout["char"], 0xd800, api.LeanBridgeError)
# Empty arrays must ignore a non-null poison pointer without dereferencing it.
scope = native._Scope()
try:
    check(getattr(native, "_from" + str(layout["sequence"]))(sequence(1, 0, None, None), scope) == ())
finally:
    scope.close()
check(api.record_shuffle(packet).count.value == (1 << 5120) + 7)
print(json.dumps({"checks": checks, "allocationFailures": allocation_failures, "conversionFailures": conversion_failures,
                  "clears": clears, "partialInputs": partial_inputs, "malformedValues": malformed}, sort_keys=True))
