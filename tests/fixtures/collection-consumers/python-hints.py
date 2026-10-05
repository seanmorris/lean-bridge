"""Check public runtime annotations without inspecting private native converters."""
import dataclasses
import inspect
import json
import time
import types
import typing

try:
    from typing import TypeAliasType
except ImportError:
    from typing_extensions import TypeAliasType


def unwrap(value):
    visited = set()
    while isinstance(value, TypeAliasType):
        assert id(value) not in visited, "cyclic runtime alias"
        visited.add(id(value))
        value = value.__value__
    return value


def array_hint(value, levels, leaf, input_value):
    for _ in range(levels):
        value = unwrap(value)
        if input_value:
            assert typing.get_origin(value) is types.UnionType
            branches = {typing.get_origin(part): typing.get_args(part) for part in typing.get_args(value)}
            assert set(branches) == {tuple, list}
            assert len(branches[tuple]) == 2 and branches[tuple][1] is Ellipsis
            assert len(branches[list]) == 1
            assert branches[tuple][0] == branches[list][0]
            value = branches[list][0]
        else:
            assert typing.get_origin(value) is tuple
            child, ellipsis = typing.get_args(value)
            assert ellipsis is Ellipsis
            value = child
    assert unwrap(value) in (None, type(None)) if leaf is None else unwrap(value) is leaf


def check_hints(api, depth=24):
    started = time.perf_counter()
    for name in api.__all__:
        member = getattr(api, name)
        if inspect.isfunction(member) or inspect.isclass(member):
            typing.get_type_hints(member)
    hints = typing.get_type_hints(api.deep)
    elapsed = (time.perf_counter() - started) * 1000
    array_hint(next(value for name, value in hints.items() if name != "return"), depth, int, True)
    array_hint(hints["return"], depth, int, False)
    shallow = 0
    primitive_types = {
        "unit": None, "bool": bool,
        **{f"{sign}int{bits}": int for sign in ("", "u") for bits in (8, 16, 32, 64)},
        "nat": int, "int": int, "usize": int, "isize": int,
        "float32": float, "float64": float, "string": str, "bytes": bytes, "char": str,
    }
    for name, leaf in primitive_types.items():
        function = getattr(api, "array_reverse_" + name, None)
        if function is None:
            continue
        hints = typing.get_type_hints(function)
        argument = next(value for name, value in hints.items() if name != "return")
        assert not isinstance(argument, TypeAliasType), "shallow input representation changed"
        array_hint(argument, 2, leaf, True)
        array_hint(hints["return"], 2, leaf, False)
        shallow += 1
    if hasattr(api, "Primitives"):
        fields = typing.get_type_hints(api.Primitives)
        assert fields["bytes_"] is bytes and fields["char_"] is str
        assert len(dataclasses.fields(api.Primitives)) == 19
    return {"depth": depth, "shallow_primitives": shallow, "type_hints_ms": elapsed}


if __name__ == "__main__":
    import lean_collections
    print(json.dumps(check_hints(lean_collections)))
