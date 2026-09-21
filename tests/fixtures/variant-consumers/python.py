"""Exercise only the installed public Python API and its named values."""
import dataclasses
import hashlib
import json
import math
import pathlib
import struct
from concurrent.futures import ThreadPoolExecutor

import lean_variants as lb

checks = calls = rejected = 0


def check(value):
    global checks
    checks += 1
    assert value


def call(fn, *args):
    global calls
    calls += 1
    return fn(*args)


def same(actual, expected):
    if dataclasses.is_dataclass(expected):
        check(type(actual) is type(expected))
        for field in dataclasses.fields(expected):
            same(getattr(actual, field.name), getattr(expected, field.name))
    elif type(expected) in (list, tuple):
        check(type(actual) is tuple)
        check(len(actual) == len(expected))
        for first, second in zip(actual, expected):
            same(first, second)
    elif type(expected) is float:
        check(type(actual) is float)
        check(math.isnan(actual) if math.isnan(expected) else actual == expected)
        if expected == 0:
            check(math.copysign(1, actual) == math.copysign(1, expected))
    else:
        check(type(actual) is type(expected))
        check(actual == expected)


def reject(fn, value, exception):
    global rejected
    try:
        call(fn, value)
    except exception:
        rejected += 1
    else:
        raise AssertionError("invalid value was accepted")
    same(call(lb.next, lb.SignalIdle()), lb.SignalStopped())


scalar = lb.ScalarsAll(
    None, True, 255, 65535, (1 << 32) - 1, (1 << 64) - 1,
    -(1 << 7), -(1 << 15), -(1 << 31), -(1 << 63),
    (1 << 5120) + 19, -((1 << 5120) + 31),
    1.5, -2.25, "A\0🌱", bytes([0, 255, 1]), "🌱", (1 << 32) - 1, -(1 << 31),
)
check(call(lb.inspect, scalar))
changed = {
    "bool_": False, "u8": 0, "u16": 0, "u32": 0, "u64": 0,
    "i8": 0, "i16": 0, "i32": 0, "i64": 0, "natural": 0, "integer": 0,
    "f32": 0.0, "f64": 0.0, "text": "", "bytes_": b"", "char_": "A",
    "word": 0, "signed_word": 0,
}
for field, value in changed.items():
    check(not call(lb.inspect, dataclasses.replace(scalar, **{field: value})))

constructors = [lb.SignalIdle(), lb.SignalStopped(), lb.SignalData(42, "A\0🌱"), lb.SignalMarker(None)]
for repeat in range(128):
    for value in constructors:
        result = call(lb.echo, value)
        same(result, value)
        check(result is not value)
        check(result.kind == value.kind)
    same(call(lb.next, constructors[0]), lb.SignalStopped())
    same(call(lb.next, constructors[1]), lb.SignalMarker(None))
    same(call(lb.next, constructors[2]), lb.SignalData(43, "A\0🌱!"))
    same(call(lb.next, constructors[3]), lb.SignalData(42, "ready"))
    for value, expected in zip(constructors, [7, 13, 48, 29]):
        same(call(lb.code, value), expected)
    for value in [lb.ModeFirst(), lb.ModeSecond(), lb.ModeThird()]:
        same(call(lb.echo_mode, value), value)
    events = list(constructors)
    packet = lb.Packet(constructors[2], events, lb.Some(constructors[3]), [lb.ModeFirst(), lb.ModeThird()])
    result = call(lb.echo_nested, lb.NestedPacket(packet))
    same(result, lb.NestedPacket(packet))
    events[0] = lb.SignalData(99, "changed")
    same(result.value.events[0], lb.SignalIdle())
    same(call(lb.echo_nested, lb.NestedPacket(lb.Packet(lb.SignalIdle(), [], None, []))),
         lb.NestedPacket(lb.Packet(lb.SignalIdle(), (), None, ())))
    for value in [lb.NestedEmpty(), lb.NestedOutcome(lb.Ok((lb.SignalMarker(None), lb.ModeSecond()))),
                  lb.NestedOutcome(lb.Err("A\0🌱"))]:
        same(call(lb.echo_nested, value), value)
    same(call(lb.signals, [[], constructors, [constructors[2], constructors[2]]]),
         ((), tuple(reversed(constructors)), (constructors[2], constructors[2])))
    same(call(lb.echo_scalars, scalar), scalar)
    same(call(lb.echo_scalars, lb.ScalarsAbsent()), lb.ScalarsAbsent())
    same(call(lb.echo_anonymous, lb.AnonymousNumber(13)), lb.AnonymousNumber(13))
    same(call(lb.echo_anonymous, lb.AnonymousPair(17, "A\0🌱")), lb.AnonymousPair(17, "A\0🌱"))
    same(call(lb.echo_anonymous, lb.AnonymousCollision(19, "A\0🌱")), lb.AnonymousCollision(19, "A\0🌱"))
    same(call(lb.echo_one, lb.OneOnly(repeat)), lb.OneOnly(repeat + 1))
    for value in [lb.BuffersEmpty(), lb.BuffersPair(b"", b""), lb.BuffersPair(bytes([0, 255]), b"abc")]:
        same(call(lb.echo_buffers, value), value)
    same(call(lb.duplicate, bytes([0, 255, 1])), lb.BuffersPair(bytes([0, 255, 1]), bytes([0, 255, 1])))

for special in [-0.0, float("inf"), -float("inf"), float("nan"), 1.0 / 3]:
    value = dataclasses.replace(scalar, f32=special, f64=special, word=(1 << 64) - 1, signed_word=-(1 << 63))
    expected = dataclasses.replace(value, f32=struct.unpack("f", struct.pack("f", special))[0])
    same(call(lb.echo_scalars, value), expected)
for char in ["\0", "\ud7ff", "\ue000", "\U0010ffff"]:
    value = dataclasses.replace(scalar, char_=char)
    same(call(lb.echo_scalars, value), value)
for field, bits in [("u8", 8), ("u16", 16), ("u32", 32), ("u64", 64), ("word", 64)]:
    for invalid in [-1, 1 << bits, True, 1.0]:
        reject(lb.echo_scalars, dataclasses.replace(scalar, **{field: invalid}), (TypeError, ValueError))
for field, bits in [("i8", 8), ("i16", 16), ("i32", 32), ("i64", 64), ("signed_word", 64)]:
    for invalid in [-(1 << (bits - 1)) - 1, 1 << (bits - 1), False, 1.0]:
        reject(lb.echo_scalars, dataclasses.replace(scalar, **{field: invalid}), (TypeError, ValueError))
for field, invalid in [("unit", 0), ("bool_", 1), ("natural", -1), ("integer", True),
                       ("f32", 1), ("f64", 2), ("text", b"abc"), ("text", "\ud800"),
                       ("bytes_", bytearray(b"abc")), ("char_", ""), ("char_", "ab"), ("char_", "\udfff")]:
    reject(lb.echo_scalars, dataclasses.replace(scalar, **{field: invalid}), (TypeError, ValueError))
for invalid in [None, {"kind": "idle"}, {"kind": "data", "count": 3, "label": "x"}, lb.ModeFirst(),
                lb.SignalData(True, "x"), lb.SignalData(1, b"x"), lb.SignalMarker(0)]:
    reject(lb.echo, invalid, TypeError)


class FakeSignal(lb.SignalData):
    pass


reject(lb.echo, FakeSignal(3, "fake"), TypeError)
cycle = []
cycle.append(cycle)
reject(lb.signals, cycle, TypeError)
reject(lb.echo, lb.SignalData(0, "x" * (8 * 1024 * 1024 + 1)), ValueError)
reject(lb.echo, lb.SignalData(0, "x" * (3 * 1024 * 1024)), ValueError)
reject(lb.produce, 17 * 1024 * 1024, lb.LeanBridgeError)
same(call(lb.produce, 30000), lb.BuffersPair(bytes([17]) * 30000, bytes([1])))
same(call(lb.make, 0), lb.SignalIdle())
same(call(lb.make, 7), lb.SignalData(7, "made"))
try:
    constructors[2].count = 2
except dataclasses.FrozenInstanceError:
    check(True)
else:
    raise AssertionError("constructor fields must be frozen")


def describe(value):
    match value:
        case lb.SignalData(count, label):
            return f"{count}:{label}"
        case lb.SignalIdle():
            return "idle"
        case lb.SignalStopped():
            return "stopped"
        case lb.SignalMarker(None):
            return "marker"
    raise AssertionError("unknown constructor")


check([describe(value) for value in constructors] == ["idle", "stopped", "42:A\0🌱", "marker"])
with ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(lambda i: lb.next(lb.SignalData(i, "thread")), range(256)))
calls += 256
for i, result in enumerate(results):
    same(result, lb.SignalData(i + 1, "thread!"))

package = pathlib.Path(lb.__file__).resolve().parent
site = package.parent
loaded = sorted({line.split(maxsplit=5)[-1].strip() for line in pathlib.Path("/proc/self/maps").read_text().splitlines()
                 if len(line.split(maxsplit=5)) == 6 and line.split(maxsplit=5)[-1].strip().startswith(str(package / "native") + "/")})
check(len(loaded) == 4)
libraries = [{"path": str(pathlib.Path(path).relative_to(site)),
              "sha256": hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest(),
              "bytes": pathlib.Path(path).stat().st_size} for path in loaded]
print(json.dumps({"checks": checks, "calls": calls, "rejected": rejected, "loadedLibraries": libraries}, sort_keys=True))
