"""Each deliberately invalid public call must be rejected by strict mypy."""
import lean_structured as api

tree = api.TreeLeaf(1)
api.call_recursive(42, lambda value: value)

def wrong_argument(value: str) -> api.Tree:
    return tree

api.call_recursive(tree, wrong_argument)
api.call_recursive(tree, lambda value: 42)
api.TreeBranch(['wrong'])
with api.make_recursive(tree) as closure:
    closure(True, 'wrong')
    value: str = closure(False, tree)

async def asynchronous(value: api.Tree) -> api.Tree:
    return value

api.call_recursive(tree, asynchronous)
seed = api.Payload('a', [], 0, None)
api.call_nested_alias(seed, lambda rows: [api.Some(42)])
with api.make_nested_plain(seed) as nested:
    nested([api.Some('wrong')])
