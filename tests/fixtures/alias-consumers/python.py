"""Independent alias expectations against a prepared, source-free wheel."""
import ctypes
import dataclasses
import math
import types
import typing

import lean_aliases as api
from lean_aliases import Some, Ok, Err, _native as native

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
    elif type(expected) in (Some, Ok, Err):
        same(actual.value, expected.value)
    elif type(expected) is tuple:
        check(len(actual) == len(expected))
        for a, b in zip(actual, expected):
            same(a, b)
    else:
        check(actual == expected)


def rejects(kind, call):
    try:
        call()
    except kind as error:
        check(True)
        same(api.make(), 41)
        return error
    raise AssertionError(f"Expected {kind}")


aliases = {
    "unit": ("AUnit", None), "bool": ("ABool", bool),
    "uint8": ("AU8", int), "uint16": ("AU16", int),
    "uint32": ("AU32", int), "uint64": ("AU64", int),
    "int8": ("AI8", int), "int16": ("AI16", int),
    "int32": ("AI32", int), "int64": ("AI64", int),
    "nat": ("ANat", int), "int": ("AInt", int),
    "float32": ("AF32", float), "float64": ("AF64", float),
    "string": ("AText", str), "bytes": ("ABytes", bytes),
    "char": ("AChar", str), "usize": ("AWord", int),
    "isize": ("ASignedWord", int),
}
extra_aliases = {"ScalarsView", "Count", "OtherCount", "Rows", "Maybe",
                 "Outcome", "PacketView", "Packets"}
check(len(aliases) + len(extra_aliases) == 27)
for name, (alias, target) in aliases.items():
    check(alias in api.__all__)
    check(getattr(api, alias) is target)
    hints = typing.get_type_hints(getattr(api, "echo_" + name))
    expected_type = types.NoneType if name == "unit" else target
    check(hints["return"] is expected_type)
    check([value for key, value in hints.items() if key != "return"] == [expected_type])
    check(typing.get_type_hints(api.Scalars)["v_" + name] is expected_type)
for name in extra_aliases:
    check(name in api.__all__)
check(api.Count is api.AU32 is api.OtherCount is int)
check(api.ScalarsView is api.Scalars)
check(api.PacketView is api.Packet)
check(api.Rows == tuple[tuple[int, ...], ...])
check(api.Packets == tuple[api.Packet, ...])
check(api.Maybe == api.Option[api.Option[None]])
check(api.Outcome == api.Result[tuple[int, bytes], str])
check(typing.get_type_hints(api.reverse_rows)["return"] == api.Rows)
check(typing.get_type_hints(api.change_packet)["return"] is api.Packet)

cases = {
    "unit": [None], "bool": [False, True],
    "nat": [0, 1, 2**53 + 1, 2**5120 + 19],
    "int": [0, -1, 2**53 + 1, 2**5120 + 31, -(2**5120 + 31)],
    "float32": [0.0, -0.0, 1 / 3, 2**-149, -2**-149, 1e300,
                float("inf"), -float("inf"), float("nan")],
    "float64": [0.0, -0.0, 1 / 3, 2**-1074, -2**-1074,
                float("inf"), -float("inf"), float("nan")],
    "string": ["", "A\0🌱", "\U0010ffff", "e\u0301"],
    "bytes": [b"", b"\0\xff\1", bytes(range(256))],
    "char": ["\0", "\ud7ff", "\ue000", "🌱", "\U0010ffff"],
}
for bits in (8, 16, 32, 64):
    cases[f"uint{bits}"] = [0, 1, 2**bits - 1]
    cases[f"int{bits}"] = [-(2**(bits - 1)), -1, 0, 2**(bits - 1) - 1]
cases["usize"], cases["isize"] = cases["uint64"], cases["int64"]
check(len(cases) == 19)
for name, values in cases.items():
    for _ in range(16):
        for value in values:
            expected = ctypes.c_float(value).value if name == "float32" else value
            same(getattr(api, "echo_" + name)(value), expected)

# Lean independently checks every record field, rather than only echoing it.
fields = dict(v_unit=None, v_bool=True, v_uint8=255, v_uint16=65535,
              v_uint32=2**32 - 1, v_uint64=2**64 - 1, v_int8=-128,
              v_int16=-32768, v_int32=-(2**31), v_int64=-(2**63),
              v_nat=2**5120 + 19, v_int=-(2**5120 + 31),
              v_float32=1.5, v_float64=-2.25, v_string="A\0🌱",
              v_bytes=b"\0\xff\1", v_char="🌱", v_usize=2**32 - 1,
              v_isize=-(2**31))
original = api.ScalarsView(**fields)
check(api.inspect(original) is True)
copy = api.echo_scalars(original)
check(copy is not original)
for name, value in fields.items():
    same(getattr(copy, name), value)
    if name != "v_unit":
        alternative = False if type(value) is bool else 0 if type(value) is int else \
            0.0 if type(value) is float else b"" if type(value) is bytes else "x"
        check(api.inspect(dataclasses.replace(original, **{name: alternative})) is False)
rejects(dataclasses.FrozenInstanceError, lambda: setattr(copy, "v_uint32", 1))
rejects(TypeError, lambda: api.echo_scalars(dataclasses.replace(original, v_unit=0)))

same(api.increment(41), 42)
same(api.increment(2**32 - 1), 0)
same(api.label(), "alias🌱")
for maybe in (None, Some(None), Some(Some(None))):
    same(api.echo_maybe(maybe), maybe)
for outcome in (Ok((0, b"")), Ok((2**32 - 1, b"\0\xff")), Err(""), Err("oops\0🌱")):
    same(api.echo_outcome(outcome), outcome)

for index in range(24):
    rows = [[1, 2, 3], [], [index]]
    packet = api.PacketView(index, "a\0🌱", rows, Some(Some(None)), Ok((7, b"\0\xff")))
    changed = api.change_packet(packet)
    check(changed is not packet)
    same(changed.count, index + 1)
    same(changed.rows, ((1, 2, 3), (), (index,)))
    same(changed.maybe, Some(Some(None)))
    same(changed.outcome, Ok((7, b"\0\xff")))
    packets = api.reverse_packets([packet, changed])
    check(type(packets) is tuple and len(packets) == 2)
    check(packets[0] is not changed and packets[1] is not packet)
    same((packets[0].count, packets[1].count), (index + 1, index))
    rows[0].clear()
    same(changed.rows[0], (1, 2, 3))
    same(packets[1].rows[0], (1, 2, 3))
same(api.reverse_rows([[1, 2], [], [3]]), ((2, 1), (), (3,)))
same(api.reverse_rows(()), ())
same(api.reverse_packets([]), ())
same(api.duplicate(b"\0\xff"), Ok((7, b"\0\xff\0\xff")))

for name, bad, kind in (
    ("unit", False, TypeError), ("bool", 1, TypeError),
    ("uint8", 256, ValueError), ("int8", -129, ValueError),
    ("uint16", 65536, ValueError), ("int16", -32769, ValueError),
    ("uint32", -1, ValueError), ("int32", 2**31, ValueError),
    ("uint64", 2**64, ValueError), ("int64", -(2**63) - 1, ValueError),
    ("nat", -1, ValueError), ("int", 1.0, TypeError),
    ("float32", 1, TypeError), ("float64", True, TypeError),
    ("string", "\ud800", UnicodeEncodeError), ("char", "\ud800", ValueError),
    ("char", "ab", ValueError), ("bytes", bytearray(b"x"), TypeError),
    ("usize", 2**64, ValueError), ("isize", -(2**63) - 1, ValueError),
):
    rejects(kind, lambda: getattr(api, "echo_" + name)(bad))
rejects(TypeError, lambda: api.reverse_rows([[True]]))
rejects(TypeError, lambda: api.echo_maybe(Some(0)))
rejects(TypeError, lambda: api.echo_outcome(Ok([1, b"x"])))
rejects(TypeError, lambda: api.echo_outcome(Err(7)))
rejects(TypeError, lambda: api.change_packet(fields))
cycle = []
cycle.append(cycle)
rejects(TypeError, lambda: api.reverse_rows(cycle))
rejects(ValueError, lambda: api.echo_bytes(bytes(16 * 1024 * 1024 + 1)))
for _ in range(3):
    failure = rejects(api.LeanBridgeError, lambda: api.produce(16 * 1024 * 1024 + 1))
    check(failure.status == 1)
    same(api.produce(3), b"\7\7\7")

# Exceptions during Python result conversion must clear the native alias target.
for public, argument in ((api.echo_outcome, Ok((7, b"x"))),
                         (api.reverse_rows, [[1, 2], []]),
                         (api.echo_scalars, original)):
    call = getattr(native, next(name for name in public.__code__.co_names if name.startswith("_call")))
    read_name = next(name for name in call.__code__.co_names if name.startswith("_from"))
    clear_name = next(name for name in call.__code__.co_names if name.startswith("_clear"))
    original_read, original_clear = getattr(native, read_name), getattr(native, clear_name)
    cleared, scopes = [], []

    def broken_read(output, scope):
        scopes.append(scope)
        raise MemoryError("injected alias conversion failure")

    def clear_output(output):
        original_clear(output)
        cleared.append(True)

    setattr(native, read_name, broken_read)
    setattr(native, clear_name, clear_output)
    try:
        for _ in range(16):
            rejects(MemoryError, lambda: public(argument))
        check(len(cleared) == 16)
        check(all(scope.owners == [] and scope.failure is None for scope in scopes))
    finally:
        setattr(native, read_name, original_read)
        setattr(native, clear_name, original_clear)
    public(argument)
    check(True)

print(f"alias-python-ok:{checks}")
