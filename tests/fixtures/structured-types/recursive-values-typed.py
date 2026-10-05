from typing import assert_never
import values as lb
import linked_values as linked


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


def describe(value: lb.Marker) -> str:
    match value:
        case lb.MarkerEmpty():
            return "empty"
        case lb.MarkerUnit(unit):
            assert unit is None
            return "unit"
        case lb.MarkerNext(child):
            return describe(child)
    assert_never(value)


spine: lb.Spine = lb.SpineNext(lb.SpineLeaf(7))
assert depth(spine) == 1
tree: lb.TreeAlias = lb.TreeBranch([])
chain: lb.TreeChain = tree
forest: lb.Forest = (chain, lb.TreeBranch((tree,)))
assert sum(size(value) for value in forest) == 3
envelope = lb.Envelope(tree, [[tree], forest], lb.Some(tree), lb.Ok((tree, tree)), lb.Some(lb.Some(None)))
assert describe(lb.MarkerNext(lb.MarkerUnit(None))) == "unit"
link: linked.Link = linked.Link(linked.Some(linked.Link(None, 1)), 2)
assert link.next is not None and link.next.value.value == 1
