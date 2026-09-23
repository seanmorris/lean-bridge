from typing import assert_never
import lean_recursive as lb


def depth(value: lb.Spine) -> int:
    match value:
        case lb.SpineLeaf():
            return 0
        case lb.SpineNext(child):
            return 1 + depth(child)
    assert_never(value)


def size(value: lb.Tree) -> int:
    match value:
        case lb.TreeBranch(children):
            return 1 + sum(size(child) for child in children)
        case lb.TreeLeaf():
            return 1
    assert_never(value)


spine: lb.Spine = lb.spine(lb.SpineNext(lb.SpineLeaf(7)))
assert depth(spine) == 1
tree: lb.TreeAlias = lb.empty()
forest: lb.Forest = lb.forest([tree, lb.TreeBranch([tree])])
assert sum(size(value) for value in forest) == 3
envelope = lb.Envelope(tree, [[tree], forest], lb.Some(tree), lb.Ok((tree, tree)), lb.Some(lb.Some(None)))
result: lb.Envelope = lb.envelope(envelope)
assert result.marker == lb.Some(lb.Some(None))
units: tuple[None, ...] = lb.units([None, None])
assert units == (None, None)
assert lb.marker(lb.MarkerUnit(None)) == lb.MarkerUnit(None)
assert lb.word_max((1 << 64) - 1)
assert lb.empty_record(lb.EmptyRecord()) == lb.EmptyRecord()
joined: lb.Tree = lb.join_trees(tree, tree)
assert size(joined) == 3
