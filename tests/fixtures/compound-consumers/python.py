"""Independent compound-value checks against an installed, source-free wheel."""
import concurrent.futures
import ctypes
import dataclasses
import math
import typing

import lean_compounds as api
from lean_compounds import Some, Ok, Err, _native as native

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
    option = getattr(api, "option_" + name)
    result = getattr(api, "result_" + name)
    product = getattr(api, "tuple_" + name)
    normalize = (lambda x: ctypes.c_float(x).value) if name == "float32" else (lambda x: x)
    same(option(None), None)
    for index in range(32):
        a, b = values[index % len(values)], values[(index + 1) % len(values)]
        same(option(Some(a)), Some(normalize(a)))
        same(result(Ok(a)), Err(normalize(a)))
        same(result(Err(a)), Ok(normalize(a)))
        same(product((a, b)), (normalize(b), normalize(a)))

states = [None, Some(None), Some(Some(None))]
state = None
for step in range(30):
    same(state, states[step % 3])
    check(api.classify(state) == step % 3)
    state = api.next(state)
same(api.make(), Some(Ok((2**64 - 1, None))))
same(api.flip(Ok((42, Some(None)))), Err((42, Some(None))))
same(api.flip(Ok((0, None))), Err((0, None)))
same(api.flip(Err(Some("a\0λ"))), Ok(Some("a\0λ")))
same(api.flip(Err(None)), Ok(None))
same(api.duplicate(None), Err("empty"))
same(api.duplicate(Some(b"\0\xff")), Ok(Some((b"\0\xff", b"\0\xff"))))

rows = [None, Some(Ok(("x\0🌱", 2**64 - 1))), Some(Err((b"\0\xff", -huge)))]
for choice in (None, Some(Ok((huge, None))), Some(Err("oops\0"))):
    for nested in (Ok(None), Ok(Some(Ok((42, None)))), Ok(Some(Err("bad"))), Err(None), Err(Some(huge))):
        packet = api.Packet(choice, ((4, "a\0"), (True, "🌱")), rows, nested)
        copied = api.transform(packet)
        expected = None if choice is None else Some(Ok((huge + 1, None))) if type(choice.value) is Ok else Some(Err("oops\0!"))
        same(copied.choice, expected)
        same(copied.products, ((5, "a\0!"), (False, "🌱")))
        same(copied.rows, tuple(reversed(rows)))
        same(copied.nested, nested)
        check(copied is not packet)
        saved = rows[0]
        rows[0] = Some(Err((b"changed", 0)))
        same(copied.rows[-1], None)
        rows[0] = saved

for depth in range(25):
    value = None if depth < 24 else Ok((42, None))
    for _ in range(depth):
        value = Some(value)
    same(api.deep(value), value)
value = Err("deep\0λ")
for _ in range(24):
    value = Some(value)
same(api.deep(value), value)
deep_error = value

# Public constructors, pattern matching and resolvable annotations.
same(Some[int](42), Some(42))
same(Ok[None](None), Ok(None))
same(Err[str]("bad"), Err("bad"))
check(next(iter(typing.get_type_hints(api.classify).values())) == api.Option[api.Option[None]])
check(typing.get_type_hints(api.flip)["return"] == api.Result[api.Option[str], tuple[int, api.Option[None]]])
for name in api.__all__:
    value = getattr(api, name)
    if name not in ("Option", "Result"):
        typing.get_type_hints(value)
        check(True)
match api.result_string(Ok("message")):
    case Err(message):
        check(message == "message")
    case _:
        raise AssertionError("wrong result branch")
rejects(dataclasses.FrozenInstanceError, lambda: setattr(Some(42), "value", 0))

# No coercion, inferred presence, flattened products or bare payloads.
class PretendSome(Some):
    pass


class PretendTuple(tuple):
    pass


for value in (0, False, (), {}, {"value": 1}, Ok(1), PretendSome(1)):
    rejects(TypeError, lambda: api.option_uint32(value))
for value in (None, 42, Some(42), (True, 42), {"ok": 42}):
    rejects(TypeError, lambda: api.result_uint32(value))
for value in ([1, 2], PretendTuple((1, 2)), "ab"):
    rejects(TypeError, lambda: api.tuple_uint32(value))
for value in ((), (1,), (1, 2, 3)):
    rejects(ValueError, lambda: api.tuple_uint32(value))
for name, bad, kind in (
    ("unit", 0, TypeError), ("bool", 1, TypeError), ("uint8", 256, ValueError),
    ("int8", -129, ValueError), ("uint64", True, TypeError), ("nat", -1, ValueError),
    ("int", 1.0, TypeError), ("float32", 1, TypeError), ("float64", True, TypeError),
    ("char", "\ud800", ValueError), ("char", "ab", ValueError),
    ("string", "\ud800", UnicodeEncodeError), ("bytes", bytearray(b"x"), TypeError),
):
    rejects(kind, lambda: getattr(api, "option_" + name)(Some(bad)))
    rejects(kind, lambda: getattr(api, "result_" + name)(Ok(bad)))
    rejects(kind, lambda: getattr(api, "result_" + name)(Err(bad)))
    rejects(kind, lambda: getattr(api, "tuple_" + name)((bad, bad)))
cycle = Some(None)
object.__setattr__(cycle, "value", cycle)
rejects(TypeError, lambda: api.deep(cycle))
rejects(ValueError, lambda: api.option_bytes(Some(bytes(16 * 1024 * 1024))))
failure = rejects(api.LeanBridgeError, lambda: api.duplicate(Some(bytes(6 * 1024 * 1024))))
check(failure.status == 1)
same(api.duplicate(Some(b"ok")), Ok(Some((b"ok", b"ok"))))

# Inject conversion failures after native allocation. Every call must clear its
# output and input scratch, and the same API must remain usable afterwards.
for public, argument in ((api.option_bytes, Some(b"x")), (api.duplicate, Some(b"x")), (api.deep, deep_error)):
    call = getattr(native, next(name for name in public.__code__.co_names if name.startswith("_call")))
    read_name = next(name for name in call.__code__.co_names if name.startswith("_from"))
    clear_name = next(name for name in call.__code__.co_names if name.startswith("_clear"))
    original_read, original_clear = getattr(native, read_name), getattr(native, clear_name)
    cleared, scopes = [], []

    def broken_read(output, scope):
        scopes.append(scope)
        raise MemoryError("injected conversion failure")

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

# Invalid private C flags must not be interpreted as valid Python variants.
for public, field in ((api.option_unit, "has_value"), (api.result_unit, "is_ok")):
    call = getattr(native, next(name for name in public.__code__.co_names if name.startswith("_call")))
    function = getattr(native, next(name for name in call.__code__.co_names if name.startswith("_fn")))
    convert = getattr(native, next(name for name in call.__code__.co_names if name.startswith("_from")))
    raw = function.argtypes[-2]._type_()
    setattr(raw, field, 2)
    scope = native._Scope()
    try:
        check(rejects(api.LeanBridgeError, lambda: convert(raw, scope)).status == 5)
    finally:
        scope.close()

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(api.option_nat, (Some(huge + i) for i in range(128))))
for index, result in enumerate(results):
    same(result, Some(huge + index))

print(f"compound-python-ok:{checks}")
