import concurrent.futures
import dataclasses
import inspect
import json
import math
import sys
import time
import typing
import lean_recursive as lb

checks = rejected = 0


def check(condition):
    global checks
    assert condition
    checks += 1


def rejects(error_type, call, status=None):
    global rejected
    try:
        call()
    except error_type as error:
        check(status is None or error.status == status)
        rejected += 1
    else:
        raise AssertionError(f"Expected {error_type}")


def scalar(**updates):
    return dataclasses.replace(lb.Scalars(
        None, True, 255, 65535, (1 << 32) - 1, (1 << 64) - 1,
        -128, -32768, -(1 << 31), -(1 << 63), (1 << 128) + 1,
        -((1 << 128) + 1), 1.5, -2.25, "A\0🌱", b"\0\xff\x01", "🌱",
        (1 << 32) - 1, -(1 << 31)), **updates)


value = scalar()
check(lb.inspect(value))  # This predicate interprets all nineteen fields in Lean.
check(lb.scalars(value) == value)
check(lb.word_max((1 << 64) - 1))
check(lb.signed_min(-(1 << 63)))
for change in [dict(natural=(1 << 1000) + 7, integer=-((1 << 1000) + 7)),
               dict(natural=0, integer=0, text="", bytes_=b""),
               dict(text="\0a🌿\0", bytes_=bytes(range(256))),
               dict(f32=-math.inf, f64=math.inf)]:
    item = scalar(**change)
    check(lb.scalars(item) == item)
special = lb.scalars(scalar(f32=math.nan, f64=-0.0))
check(math.isnan(special.f32) and math.copysign(1, special.f64) == -1)
check(lb.scalars(scalar(f32=1 + 2**-24)).f32 == 1)
for field, bits, signed in [("u8", 8, False), ("u16", 16, False), ("u32", 32, False),
                            ("u64", 64, False), ("i8", 8, True), ("i16", 16, True),
                            ("i32", 32, True), ("i64", 64, True),
                            ("word", 64, False), ("signed_word", 64, True)]:
    minimum = -(1 << (bits - 1)) if signed else 0
    maximum = (1 << (bits - int(signed))) - 1
    for number in [minimum, maximum]:
        check(getattr(lb.scalars(scalar(**{field: number})), field) == number)
    for number in [minimum - 1, maximum + 1]:
        invalid = scalar(**{field: number})
        rejects(ValueError, lambda: lb.scalars(invalid))
    for number in [True, 1.0, "1"]:
        invalid = scalar(**{field: number})
        rejects(TypeError, lambda: lb.scalars(invalid))
for field, bad in [("unit", 0), ("bool_", 1), ("natural", True), ("integer", 1.0),
                   ("f32", 1), ("f64", True), ("bytes_", bytearray(b"x")), ("text", b"x"),
                   ("char_", 65)]:
    invalid = scalar(**{field: bad})
    rejects(TypeError, lambda: lb.scalars(invalid))
for field, bad in [("natural", -1), ("char_", ""), ("char_", "ab"), ("char_", "\ud800"),
                   ("text", "\udfff")]:
    invalid = scalar(**{field: bad})
    rejects(ValueError, lambda: lb.scalars(invalid))
tree = lb.TreeBranch((lb.TreeLeaf(value), lb.TreeBranch(())))
check(lb.tree(tree) == tree)
check(lb.empty() == lb.TreeBranch(()))
check(lb.join_trees(tree, tree) == lb.TreeBranch((tree, tree)))
check(lb.forest([tree] * 512) == (tree,) * 512)
check(lb.forest(()) == ())
input_list = [lb.TreeBranch([])]
copied = lb.tree(lb.TreeBranch(input_list))
input_list[0].children.append(lb.TreeLeaf(value))
check(copied == lb.TreeBranch((lb.TreeBranch(()),)))
alias_copies = lb.forest([tree, tree])
check(alias_copies[0] is not alias_copies[1])
for marker in [None, lb.Some(None), lb.Some(lb.Some(None))]:
    for outcome in [lb.Ok((tree, tree)), lb.Err("error\0🌱")]:
        for fallback in [None, lb.Some(tree)]:
            envelope = lb.Envelope(tree, ((), (tree,)), fallback, outcome, marker)
            check(lb.envelope(envelope) == envelope)
left = lb.LeftTreeNext(lb.RightTreeMany((lb.LeftTreeLeaf(9),)))
check(lb.left(left) == left)
check(lb.right(lb.RightTreeMany((left,))) == lb.RightTreeMany((left,)))
spine = lb.SpineLeaf(41)
for _ in range(127):
    spine = lb.SpineNext(spine)
a, b = spine, lb.spine(spine)
for _ in range(127):
    check(a is not b)
    a, b = a.value, b.value
check(a.value == b.value == 41)
rejects(lb.LeanBridgeError, lambda: lb.grow(spine), 2)
rejects(ValueError, lambda: lb.spine(lb.SpineNext(spine)))
check(lb.grow(lb.SpineLeaf(7)) == lb.SpineNext(lb.SpineLeaf(7)))
wide = lb.WideNext(**{f"field{i}": i for i in range(255)}, child=lb.WideLeaf(17))
check(lb.wide(wide) == wide)
for marker in [lb.MarkerEmpty(), lb.MarkerUnit(None), lb.MarkerNext(lb.MarkerEmpty())]:
    check(lb.marker(marker) == marker)
check(lb.empty_record(lb.EmptyRecord()) == lb.EmptyRecord())
check(lb.units([None] * 123) == (None,) * 123)
rejects(ValueError, lambda: lb.never(object()))
rejects(TypeError, lambda: lb.spine(lb.MarkerEmpty()))
rejects(TypeError, lambda: lb.tree({"kind": "branch", "children": []}))
rejects(TypeError, lambda: lb.envelope(dataclasses.replace(envelope, marker=True)))
rejects(TypeError, lambda: lb.join_trees(tree, lb.TreeLeaf(scalar(u32=True))))
rejects(dataclasses.FrozenInstanceError, lambda: setattr(tree, "children", ()))


class FakeLeaf(lb.SpineLeaf):
    pass


rejects(TypeError, lambda: lb.spine(FakeLeaf(1)))
cyclic = []
cyclic_tree = lb.TreeBranch(cyclic)
cyclic.append(cyclic_tree)
rejects(ValueError, lambda: lb.tree(cyclic_tree))
cyclic.clear()
rejects(ValueError, lambda: lb.forest([lb.TreeBranch(())] * 262144))
rejects(ValueError, lambda: lb.scalars(scalar(text="x" * (16 * 1024 * 1024))))
check(lb.tree(tree) == tree)
check(lb.inspect(value))


def threaded(index):
    own = lb.SpineNext(lb.SpineLeaf(index))
    for _ in range(16):
        assert lb.spine(own) == own
    return index


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    check(list(pool.map(threaded, range(16))) == list(range(16)))
functions = [name for name in lb.__all__ if inspect.isfunction(getattr(lb, name))]
check(len(functions) == 18)
started = time.monotonic()
for name in functions:
    hints = typing.get_type_hints(getattr(lb, name))
    check("return" in hints and len(repr(hints)) < 10000)
    check("Any" not in repr(hints))
for record in [lb.Envelope, lb.TreeBranch, lb.WideNext, lb.Scalars]:
    check(len(repr(typing.get_type_hints(record))) < 10000)
check(time.monotonic() - started < 2)
parameter = next(iter(inspect.signature(lb.spine).parameters))
check(lb.spine(**{parameter: lb.SpineLeaf(19)}) == lb.SpineLeaf(19))
print(json.dumps({"checks": checks, "rejected": rejected, "functions": len(functions),
                  "threads": 4, "threadedCalls": 256, "python": sys.version.split()[0]}))
