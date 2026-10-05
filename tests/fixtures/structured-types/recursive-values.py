import copy
import dataclasses
import importlib.util
import json
import sys
import time
import typing
import values as lb
import linked_values as linked
import deep_values as deep

checks = 0


def check(condition):
    global checks
    assert condition
    checks += 1


leaf = lb.SpineLeaf(7)
spine = lb.SpineNext(leaf)
check(spine.value is leaf)
check(spine == copy.deepcopy(spine))
check(spine is not copy.deepcopy(spine))
check(spine.kind == "next")
check(lb.MarkerEmpty() != lb.MarkerUnit(None))
check(lb.EmptyRecord() == lb.EmptyRecord())
check(lb.Some(None) != None)
check(lb.Some(lb.Some(None)) != lb.Some(None))
check(lb.Ok(None) != lb.Err(None))
check(lb.TreeAlias is lb.Tree)
check(lb.TreeChain is lb.TreeAlias)
left = lb.LeftTreeNext(lb.RightTreeMany([lb.LeftTreeLeaf(9)]))
check(left.right.lefts[0].value == 9)
tree = lb.TreeBranch([])
envelope = lb.Envelope(tree, [[tree]], lb.Some(tree), lb.Ok((tree, tree)), lb.Some(lb.Some(None)))
other = copy.deepcopy(envelope)
check(other == envelope)
other.tree.children.append(lb.TreeBranch(()))
check(envelope.tree.children == [])
check(other.tree is not envelope.tree)
match spine:
    case lb.SpineNext(lb.SpineLeaf(value)):
        check(value == 7)
    case _:
        raise AssertionError("Named recursive pattern did not match")
try:
    spine.value = leaf
except dataclasses.FrozenInstanceError:
    check(True)
else:
    raise AssertionError("Record is mutable")
check(not hasattr(spine, "__dict__"))
check([field.name for field in dataclasses.fields(lb.Scalars)] == [
    "unit", "bool_", "u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64",
    "natural", "integer", "f32", "f64", "text", "bytes_", "char_", "word", "signed_word"
])
wide = lb.WideNext(**{f"field{i}": i for i in range(255)}, child=lb.WideLeaf(17))
check(wide.field254 == 254 and wide.child.value == 17)
check(copy.deepcopy(wide) == wide)
link = linked.Link(linked.Some(linked.Link(None, 1)), 2)
check(link.next.value.value == 1)
check(typing.get_type_hints(linked.Link)["value"] is int)
start = time.monotonic()
for name in lb.__all__:
    value = getattr(lb, name)
    if isinstance(value, type) and dataclasses.is_dataclass(value):
        hints = typing.get_type_hints(value)
        check(all(field.name in hints for field in dataclasses.fields(value)))
check(typing.get_type_hints(lb.SpineNext)["value"] == lb.Spine)
check(typing.get_type_hints(lb.TreeLeaf)["payload"] is lb.Scalars)
check(typing.get_type_hints(lb.Envelope)["tree"] == lb.TreeAlias)
check(typing.get_args(lb.Forest.__value__) == (lb.Tree, Ellipsis))
check(typing.get_args(typing.get_type_hints(linked.Link)["next"].__value__)[1] is type(None))
if sys.version_info >= (3, 12):
    check(importlib.util.find_spec("typing_extensions") is None)
else:
    from importlib.metadata import version
    check(version("typing_extensions") == sys.argv[1])


def accept(value: deep.Alias699) -> deep.Alias699:
    return value


hints = typing.get_type_hints(accept)
check(hints["value"] is deep.Alias699)
check(hints["return"] is deep.Alias699)
check(hasattr(deep.Alias699, "__value__"))
check(time.monotonic() - start < 2)
print(json.dumps({"checks": checks, "python": sys.version.split()[0], "aliases": 700}))
