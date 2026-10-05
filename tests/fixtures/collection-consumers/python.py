"""Independent caller of the installed public collection API."""
import dataclasses
import gc
import hashlib
import json
import math
import pathlib
import struct
import threading
from concurrent.futures import ThreadPoolExecutor

import lean_collections as api

checks = calls = rejected = 0
counter_lock = threading.Lock()
FIELDS = {
    api.Primitives: "unit flag u8 u16 u32 u64 i8 i16 i32 i64 natural integer f32 f64 text bytes_ char_ usize isize".split(),
    api.Empty: [], api.Single: ["value"], api.Count: ["value"],
    api.Pair: ["first", "second"], api.Reversed: ["second", "first"],
    api.Packet: "label values empty single count pair reversed".split(),
}


def check(value):
    global checks
    with counter_lock:
        checks += 1
    assert value


def call(name, *args):
    global calls
    with counter_lock:
        calls += 1
    return getattr(api, name)(*args)


def reject(kind, function):
    global rejected
    try:
        function()
    except kind:
        rejected += 1
    else:
        raise AssertionError("invalid value was accepted")
    same(call("array_reverse_uint32", [[1, 2, 3]]), ((3, 2, 1),))


def leaf(kind, actual, expected):
    check(type(actual) is type(expected))
    if kind == "float32":
        try:
            expected = struct.unpack("<f", struct.pack("<f", expected))[0]
        except OverflowError:
            expected = math.copysign(float("inf"), expected)
    if kind in ("float32", "float64"):
        check(math.isnan(actual) if math.isnan(expected) else struct.pack("<d", actual) == struct.pack("<d", expected))
    else:
        check(actual == expected)


def same(actual, expected):
    if type(expected) in FIELDS:
        check(type(actual) is type(expected))
        check(actual.__dataclass_params__.frozen)
        for index, field in enumerate(FIELDS[type(expected)]):
            if type(expected) is api.Primitives:
                leaf(CASES[index][0], getattr(actual, field), getattr(expected, field))
            else:
                same(getattr(actual, field), getattr(expected, field))
    elif type(expected) in (list, tuple):
        check(type(actual) is tuple)
        check(len(actual) == len(expected))
        for first, second in zip(actual, expected):
            same(first, second)
    else:
        leaf("float64" if type(expected) is float else "scalar", actual, expected)


HUGE = (1 << 5120) + (1 << 255) + 17
FLOATS32 = [struct.unpack("<f", struct.pack("<I", bits))[0] for bits in
            [0, 0x80000000, 1, 0x7fffff, 0x800000, 0x3f800000, 0x7f7fffff, 0x7f800000, 0xff800000, 0x7fc00000]]
FLOATS64 = [struct.unpack("<d", struct.pack("<Q", bits))[0] for bits in
            [0, 0x8000000000000000, 1, 0xfffffffffffff, 0x10000000000000, 0x3ff0000000000000,
             0x7fefffffffffffff, 0x7ff0000000000000, 0xfff0000000000000, 0x7ff8000000000000]]
CASES = [
    ("unit", [None], [(TypeError, 0), (TypeError, False), (TypeError, [])]),
    ("bool", [False, True], [(TypeError, 0), (TypeError, 1), (TypeError, "true"), (TypeError, None)]),
    *[(f"uint{bits}", [0, 1, 1 << (bits - 1), (1 << bits) - 1],
       [(ValueError, -1), (ValueError, 1 << bits), (TypeError, 1.5), (TypeError, "1"), (TypeError, True)]) for bits in (8, 16, 32, 64)],
    *[(f"int{bits}", [-(1 << (bits - 1)), -1, 0, (1 << (bits - 1)) - 1],
       [(ValueError, -(1 << (bits - 1)) - 1), (ValueError, 1 << (bits - 1)), (TypeError, 1.5), (TypeError, "1")]) for bits in (8, 16, 32, 64)],
    ("nat", [0, 1, HUGE], [(ValueError, -1), (TypeError, 1.0), (TypeError, True)]),
    ("int", [-HUGE, 0, HUGE], [(TypeError, 1.0), (TypeError, True), (TypeError, "1")]),
    ("float32", FLOATS32 + [1.0000000596046448, 1e300], [(TypeError, 1), (TypeError, "1"), (TypeError, None)]),
    ("float64", FLOATS64, [(TypeError, 1), (TypeError, "1"), (TypeError, None)]),
    ("string", ["", "\0", "A\0B", "e\u0301🙂", "\U0010ffff"], [(TypeError, None), (TypeError, b"abc"), (ValueError, "\ud800")]),
    ("bytes", [b"", b"\0\xff", bytes(range(256))], [(TypeError, None), (TypeError, bytearray(b"abc")), (TypeError, "abc")]),
    ("char", list(map(chr, [0, 65, 0x301, 0xd7ff, 0xe000, 0xffff, 0x1f642, 0x10ffff])),
     [(ValueError, ""), (ValueError, "ab"), (ValueError, "\udfff"), (TypeError, 65), (TypeError, None)]),
    ("usize", [0, 1, (1 << 32) - 1, (1 << 53) + 1, (1 << 64) - 1], [(ValueError, -1), (ValueError, 1 << 64), (TypeError, "1")]),
    ("isize", [-(1 << 63), -(1 << 53) - 1, -1, 0, (1 << 63) - 1], [(ValueError, -(1 << 63) - 1), (ValueError, 1 << 63), (TypeError, "1")]),
]


def primitive(index):
    return api.Primitives(*(values[index % len(values)] for _, values, _ in CASES))


for record_type, fields in FIELDS.items():
    check([field.name for field in dataclasses.fields(record_type)] == fields)
    reject(TypeError, lambda: record_type(extra=1))

primitives = []
for name, values, invalid in CASES:
    before = checks
    same(call("array_reverse_" + name, []), ())
    same(call("array_reverse_" + name, [[], ()]), ((), ()))
    for index in range(128):
        row = [values[index % len(values)], values[(index + 1) % len(values)], values[(index + 2) % len(values)], values[index % len(values)]]
        argument = [row, (), (values[0],), tuple(row)]
        result = call("array_reverse_" + name, tuple(argument) if index % 2 else argument)
        check(type(result) is tuple and len(result) == len(argument))
        for actual, expected in zip(result, reversed(argument)):
            check(type(actual) is tuple and len(actual) == len(expected))
            for first, second in zip(actual, reversed(expected)):
                leaf(name, first, second)
    reject(TypeError, lambda: call("array_reverse_" + name, None))
    for exception, bad in invalid:
        reject(exception, lambda: call("array_reverse_" + name, [[values[0]], [values[0], bad]]))
    primitives.append({"name": name, "checks": checks - before, "rejected_cases": len(invalid) + 1})

for index in range(128):
    a, b, c = primitive(index), primitive(index + 1), primitive(index + 2)
    same(call("record_reverse", [a, b, c]), (c, b, a))
same(call("record_reverse", []), ())
interpreted = [None, True, 255, 65535, (1 << 32) - 1, (1 << 64) - 1,
               -128, -32768, -(1 << 31), -(1 << 63), 1 << 200, -(1 << 200), -0.0, 3.25,
               "🌱\0", b"\xff\0\x80", "🌱", (1 << 64) - 1, -(1 << 31)]
record = api.Primitives(*interpreted)
check(call("array_check_elements", *([value] for value in interpreted)))
check(call("record_inspect", record))
for index in range(1, len(interpreted)):
    changed = list(interpreted)
    changed[index] = next(value for value in CASES[index][1] if value != interpreted[index])
    check(not call("array_check_elements", *([value] for value in changed)))
    check(not call("record_inspect", api.Primitives(*changed)))
same(call("array_add", 7, [[-HUGE, HUGE], ()]), ((-HUGE + 7, HUGE + 7), ()))
same(call("array_total", [[HUGE, 1], (), [HUGE]]), 2 * HUGE + 1)
same(call("array_total", ()), 0)
same(call("array_words"), (("\uFEFFLean", "🌱\0"), ()))
same(call("array_size", [None, None]), 2)
same(call("array_size", ()), 0)
same(call("record_empty", api.Empty()), api.Empty())
same(call("record_single", api.Single((1 << 64) - 1)), api.Single(0))
same(call("record_count", api.Count(HUGE)), api.Count(HUGE + 1))
same(call("record_make"), api.Pair(42, "\uFEFF🌱\0"))
for index in range(32):
    values = [[record], [], [record, record]]
    packet = api.Packet("parcel\0", values, api.Empty(), api.Single((1 << 64) - 1),
                        api.Count(HUGE), api.Pair((1 << 32) - 1, "a"), api.Reversed("b", index))
    expected = api.Packet("parcel\0!", ((record, record), (), (record,)), api.Empty(),
                          api.Single(0), api.Count(HUGE + 7), api.Pair(0, "ap"), api.Reversed("br", index + 2))
    result = call("record_shuffle", packet)
    same(result, expected)
    copies = call("record_duplicate", packet)
    same(copies, (packet, packet))
    check(copies[0] is not copies[1] and copies[0].values[0][0] is not copies[1].values[0][0])
    values[0][0] = primitive(1)
    same(result, expected)
    same(copies[1].values[0][0], record)
    check(result == expected)
same(call("array_duplicate", [b"\0\xff"]), (b"\0\xff", b"\0\xff"))
shared = [1, 2]
result = call("array_reverse_uint32", [shared, shared])
shared[0] = 9
same(result, ((2, 1), (2, 1)))
for depth in range(25):
    value = 42 if depth == 24 else []
    for level in range(depth):
        value = [value] if level % 2 else (value,)
    same(call("deep", value), value)
cycle = []
cycle.append(cycle)
reject(TypeError, lambda: call("deep", cycle))
reject(AttributeError, lambda: call("record_inspect", object.__new__(api.Primitives)))
reject(TypeError, lambda: call("record_inspect", {}))


class PretendRecord(api.Primitives):
    pass


class PretendList(list):
    def __len__(self):
        return 1


reject(TypeError, lambda: call("record_inspect", PretendRecord(*interpreted)))
reject(TypeError, lambda: call("array_reverse_uint32", PretendList([[1, 2]])))
reject(dataclasses.FrozenInstanceError, lambda: setattr(record, "flag", False))
for _ in range(3):
    reject(ValueError, lambda: call("array_reverse_bytes", [[b"x" * (16 * 1024 * 1024)]]))
    reject(ValueError, lambda: call("array_reverse_uint32", [[0] * 2_097_153]))
    reject(api.LeanBridgeError, lambda: call("array_duplicate", [b"x" * (6 * 1024 * 1024)]))
    reject(ValueError, lambda: call("array_reverse_string", [["x" * (3 * 1024 * 1024)]]))
    reject(api.LeanBridgeError, lambda: call("generate", 17 * 1024 * 1024))
same(call("generate", 30000), (None,) * 30000)
a, b = api.Pair(42, "value"), api.Pair(42, "value")
check(a == b and hash(a) == hash(b) and {a: 7}[b] == 7)
check(a != api.Reversed("value", 42))
match a:
    case api.Pair(42, "value"):
        check(True)
    case _:
        raise AssertionError("record pattern did not match")
gc.collect()
with ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(lambda index: call("array_reverse_uint32", [[index, 42], [], [index]]), range(256)))
for index, result in enumerate(results):
    same(result, ((index,), (), (42, index)))

package = pathlib.Path(api.__file__).resolve().parent
site = package.parent
loaded = sorted({line.split(maxsplit=5)[-1].strip() for line in pathlib.Path("/proc/self/maps").read_text().splitlines()
                 if len(line.split(maxsplit=5)) == 6 and line.split(maxsplit=5)[-1].strip().startswith(str(package / "native") + "/")})
check(len(loaded) == 4)
libraries = [{"path": str(pathlib.Path(path).relative_to(site)), "sha256": hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest(),
              "bytes": pathlib.Path(path).stat().st_size} for path in loaded]
print(json.dumps({"checks": checks, "calls": calls, "rejected": rejected, "primitives": primitives,
                  "recordTypes": [record_type.__name__ for record_type in FIELDS], "loadedLibraries": libraries}, sort_keys=True))
