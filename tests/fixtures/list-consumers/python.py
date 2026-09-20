"""Independent List expectations against an installed, source-free wheel."""
import concurrent.futures
import ctypes
import math
import typing

import lean_lists as api
from lean_lists import Some, Ok, Err, _native as native

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
        return error
    raise AssertionError(f"Expected {kind}")


huge = 2**5120 + 2**255 + 17
cases = {
    "unit": [None],
    "bool": [False, True],
    "nat": [0, 1, 2**32, 2**53 + 1, 2**64, huge],
    "int": [0, -1, -(2**32), 2**53 + 1, -(2**64), huge, -huge],
    "float32": [0.0, -0.0, 1 / 3, 2**-149, -2**-149, 1e300,
                float("inf"), -float("inf"), float("nan")],
    "float64": [0.0, -0.0, 1 / 3, 2**-1074, -2**-1074,
                float("inf"), -float("inf"), float("nan")],
    "string": ["", "a\0λ🌿", "\0", "\U0010ffff", "e\u0301"],
    "bytes": [b"", b"\0\xff\x80", bytes(range(256))],
    "char": ["\0", "\x7f", "\ud7ff", "\ue000", "\uffff", "🌿", "\U0010ffff"],
}
for bits in (8, 16, 32, 64):
    cases[f"uint{bits}"] = [0, 1, 2**bits - 1]
    cases[f"int{bits}"] = [-(2**(bits - 1)), -1, 0, 2**(bits - 1) - 1]
cases["usize"] = cases["uint64"]
cases["isize"] = cases["int64"]
check(len(cases) == 19)

for name, values in cases.items():
    reverse = getattr(api, "reverse_" + name)
    normalize = (lambda x: ctypes.c_float(x).value) if name == "float32" else (lambda x: x)
    same(reverse([]), ())
    same(reverse(()), ())
    for index in range(32):
        a, b = values[index % len(values)], values[(index + 1) % len(values)]
        input = [a, b, a, a]
        expected = tuple(normalize(value) for value in reversed(input))
        same(reverse(input), expected)
        same(reverse(tuple(input)), expected)
        same(reverse([a]), (normalize(a),))

same(api.join(["a\0", "", "🌿"]), "a\0🌱🌱🌿")
same(api.join([]), "")
same(api.mix([[1, 2, 3], [], [4]]), ((4,), (), (3, 2, 1)))

for index in range(20):
    sequences = [[1, 2, 3], [], [index]]
    branches = [None, Some(Ok((huge, None))), Some(Err("oops\0"))]
    arrays = [[(True, "🌿"), (False, "\0")], []]
    packet = api.Packet(sequences, branches, [b"\0\xff", b""], arrays)
    copied = api.transform(packet)
    same(copied.sequences, ((index,), (), (3, 2, 1)))
    same(copied.branches, (Some(Err("oops\0!")), Some(Ok((huge + 1, None))), None))
    same(copied.buffers, (b"", b"\0\xff"))
    same(copied.arrays, ((), ((False, "\0"), (True, "🌿"))))
    check(copied is not packet)
    sequences[0][0] = 99
    arrays[0].clear()
    branches[1] = None
    same(copied.sequences[2], (3, 2, 1))
    same(copied.arrays[1], ((False, "\0"), (True, "🌿")))
same(api.duplicate(b"\0\xff"), (b"\0\xff", b"\0\xff"))
same(api.duplicate(b""), (b"", b""))
same(api.nest(None), None)
same(api.nest(Some([])), Some(()))
same(api.nest(Some([Ok([None, None]), Err("bad\0"), Ok([])])),
     Some((Ok(()), Err("bad\0!"), Ok((None, None)))))
same(api.swap(Err(["first", "last"])), Ok(("last", "first")))
same(api.swap(Ok(([huge, 42], [1, 2, 3]))), Err(((42, huge), (3, 2, 1))))
for depth in range(25):
    input = 42 if depth == 24 else []
    expected = 42 if depth == 24 else ()
    for _ in range(depth):
        input, expected = [input], (expected,)
    same(api.deep(input), expected)
deep_value = input

# Precise public annotations and owned tuple results, with no ctypes objects.
for name in api.__all__:
    if name not in ("Option", "Result"):
        typing.get_type_hints(getattr(api, name))
        check(True)
check(typing.get_type_hints(api.reverse_uint32)["return"] == tuple[int, ...])
check(next(value for name, value in typing.get_type_hints(api.reverse_uint32).items()
           if name != "return") == tuple[int, ...] | list[int])

class PretendList(list):
    pass


class PretendTuple(tuple):
    pass


for input in (None, "abc", b"abc", {}, {1, 2}, iter([1]), PretendList([1]), PretendTuple((1,))):
    rejects(TypeError, lambda: api.reverse_uint32(input))
for name, bad, kind in (
    ("unit", 0, TypeError), ("bool", 1, TypeError), ("uint8", 256, ValueError),
    ("int8", -129, ValueError), ("uint64", True, TypeError), ("nat", -1, ValueError),
    ("int", 1.0, TypeError), ("float32", 1, TypeError), ("float64", True, TypeError),
    ("char", "\ud800", ValueError), ("char", "ab", ValueError),
    ("string", "\ud800", UnicodeEncodeError), ("bytes", bytearray(b"x"), TypeError),
    ("usize", 2**64, ValueError), ("isize", -(2**63) - 1, ValueError),
):
    rejects(kind, lambda: getattr(api, "reverse_" + name)([cases[name][0], bad]))
cycle = []
cycle.append(cycle)
rejects(TypeError, lambda: api.deep(cycle))
rejects(TypeError, lambda: api.nest(Some([None])))
rejects(TypeError, lambda: api.swap(Ok(([1], [False]))))
rejects(ValueError, lambda: api.reverse_unit([None] * (2**21 + 1)))

for _ in range(3):
    failure = rejects(api.LeanBridgeError, lambda: api.duplicate(bytes(6 * 1024 * 1024)))
    check(failure.status == 1)
    same(api.duplicate(b"ok"), (b"ok", b"ok"))
failure = rejects(api.LeanBridgeError, lambda: api.generate(2097153))
check(failure.status == 1)
same(api.generate(1), (7,))
same(api.generate(30000), (7,) * 30000)

# Inject Python failures after native allocation; every call clears native output
# and scratch, and then succeeds again through the unchanged public API.
for public, argument in ((api.reverse_bytes, [b"x", b"y"]),
                         (api.nest, Some([Ok([None]), Err("x")])),
                         (api.deep, deep_value)):
    call = getattr(native, next(name for name in public.__code__.co_names if name.startswith("_call")))
    read_name = next(name for name in call.__code__.co_names if name.startswith("_from"))
    clear_name = next(name for name in call.__code__.co_names if name.startswith("_clear"))
    original_read, original_clear = getattr(native, read_name), getattr(native, clear_name)
    cleared, scopes = [], []

    def broken_read(output, scope):
        scopes.append(scope)
        raise MemoryError("injected List conversion failure")

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

# Input allocation failures release previously copied elements before Lean runs.
original_allocate = native._Scope.allocate
for limit in range(4):
    scopes = []
    attempts = 0

    def fail_allocate(scope, element, count):
        global attempts
        scopes.append(scope)
        attempts += 1
        if attempts == limit + 1:
            raise MemoryError("injected List input allocation failure")
        return original_allocate(scope, element, count)

    native._Scope.allocate = fail_allocate
    try:
        rejects(MemoryError, lambda: api.reverse_bytes([b"x", b"y", b"z"]))
        check(scopes and all(not scope.owners and scope.failure is None for scope in scopes))
    finally:
        native._Scope.allocate = original_allocate
same(api.reverse_bytes([b"x", b"y"]), (b"y", b"x"))

# Refuse invalid private output lengths/pointers before reading native memory.
call = getattr(native, next(name for name in api.reverse_uint32.__code__.co_names if name.startswith("_call")))
function = getattr(native, next(name for name in call.__code__.co_names if name.startswith("_fn")))
convert = getattr(native, next(name for name in call.__code__.co_names if name.startswith("_from")))
for length, kind in ((1, api.LeanBridgeError), (2**64 - 1, ValueError)):
    raw = function.argtypes[-2]._type_()
    raw.length = length
    scope = native._Scope()
    try:
        rejects(kind, lambda: convert(raw, scope))
    finally:
        scope.close()

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(api.reverse_nat, ([huge + i, 42] for i in range(128))))
for index, result in enumerate(results):
    same(result, (42, huge + index))

print(f"list-python-ok:{checks}")
