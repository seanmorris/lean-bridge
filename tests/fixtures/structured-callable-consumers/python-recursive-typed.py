"""Strictly typed public use of recursive values and callback-only aliases."""
from typing import assert_type
import lean_structured as api

leaf = api.TreeLeaf(1 << 300)
tree = api.TreeBranch([leaf, api.TreeBranch(())])

def preserve(value: api.Tree) -> api.Tree:
    if isinstance(value, api.TreeLeaf):
        assert_type(value.value, int)
    else:
        for child in value.children:
            preserve(child)
    return value

assert_type(api.call_recursive(tree, preserve), api.Tree)
with api.make_recursive(tree) as closure:
    assert_type(closure(True, leaf), api.Tree)
    assert_type(closure(False, tree), api.Tree)

seed = api.Payload('a\0🌿', (api.Some('λ'),), 1 << 256, None)

def aliases(rows: tuple[api.Option[api.Alias], ...]) -> list[api.Option[api.Alias]]:
    return list(rows)

assert_type(api.call_nested_alias(seed, aliases), str)
assert_type(api.call_nested_plain(seed, aliases), str)
with api.make_nested_alias(seed) as alias_closure:
    result: tuple[api.Option[api.Payload], ...] = alias_closure([api.Some(seed), None])
    assert result == (api.Some(seed), None, api.Some(seed))
