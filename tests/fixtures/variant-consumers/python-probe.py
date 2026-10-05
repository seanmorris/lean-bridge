"""Private installed-adapter fault probes, separate from the public consumer."""
import ctypes
import gc
import json
import re
import weakref

import lean_variants as lb
from lean_variants import _native as native

checks = allocation_failures = conversion_failures = clears = malformed_tags = inactive_cases = 0


def check(value):
    global checks
    checks += 1
    assert value


def checked_call(fn, value, fail_at=None, decode=False):
    global clears
    conversions = 0
    closed = 0
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
        check(scope.owners == [])
        check(scope.failure is None)
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
        fn(value)
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


signal = lb.SignalData(7, "A\0🌱")
scalar = lb.ScalarsAll(None, True, 255, 65535, 19, (1 << 64) - 1, -7, -13, -19, -(1 << 63),
                      (1 << 5120) + 19, -((1 << 5120) + 31), 1.5, -2.25, "A\0🌱", b"\0\xff", "🌱", 19, -19)
packet = lb.Packet(signal, [signal, lb.SignalMarker(None), signal], lb.Some(signal), [lb.ModeThird()])
cases = [(lb.echo, signal), (lb.echo_scalars, scalar), (lb.echo_nested, lb.NestedPacket(packet)),
         (lb.echo_nested, lb.NestedOutcome(lb.Err("A\0🌱"))), (lb.signals, [[signal, signal], [signal]])]
for fn, value in cases:
    for decode in [False, True]:
        count = checked_call(fn, value, decode=decode)
        check(count > 0)
        for limit in range(count):
            checked_call(fn, value, fail_at=limit, decode=decode)
            if decode:
                conversion_failures += 1
            else:
                allocation_failures += 1
            check(lb.next(lb.SignalIdle()) == lb.SignalStopped())
        checked_call(fn, value, decode=decode)

# Typed union layouts come from the installed adapter. Poison every inactive byte.
for name, value_type in list(vars(native).items()):
    if not re.fullmatch(r"_T\d+", name) or [field[0] for field in value_type._fields_] != ["kind", "cases"]:
        continue
    value = value_type()
    ctypes.memset(ctypes.addressof(value), 0xff, ctypes.sizeof(value))
    decode = getattr(native, "_from" + name[2:])
    scope = native._Scope()
    try:
        decode(value, scope)
    except lb.LeanBridgeError as error:
        check(error.status == 5 and "constructor" in str(error))
        malformed_tags += 1
    else:
        raise AssertionError("invalid native constructor was accepted")
    finally:
        scope.close()
    value.kind = 0
    scope = native._Scope()
    try:
        result = decode(value, scope)
        check(type(result).__module__ == "lean_variants")
        inactive_cases += 1
    finally:
        scope.close()

check(malformed_tags == 7 and inactive_cases == 7)
check(lb.echo_nested(lb.NestedPacket(packet)).value.current == signal)
print(json.dumps({"checks": checks, "allocationFailures": allocation_failures,
                  "conversionFailures": conversion_failures, "clears": clears,
                  "malformedTags": malformed_tags, "inactiveCases": inactive_cases}, sort_keys=True))
