"""Synthetic caller controls. This file does not execute Lean or an installed package."""
import json
import runpy
import sys
from dataclasses import dataclass
from types import SimpleNamespace


@dataclass(frozen=True)
class Some:
    value: object


@dataclass(frozen=True)
class Ok:
    value: object


@dataclass(frozen=True)
class Err:
    value: object


class LeanBridgeError(RuntimeError):
    def __init__(self, message):
        super().__init__(message)
        self.status = 1


prefix = sys.argv[2]


def refusal(path, name):
    raise LeanBridgeError(path + ' was rejected by StructuralSubtypes.' + name)


def positive(value, path, normalize=False):
    if value <= 0:
        refusal(path, 'normalizePositive' if normalize else 'checkedPositive')
    return value + int(normalize)


def word(value, path):
    if not value:
        refusal(path, 'checkedWord')
    return value


def group(values, path, normalize=False):
    return tuple(None if item is None else Some(positive(item.value, f'{path}[{i}]?', normalize))
                 for i, item in enumerate(values))


def bound(value, path, maximum):
    if value >= maximum:
        raise LeanBridgeError(path + ' is not below its Fin ' + str(maximum) + ' bound')


def make_api():
    arg = prefix + '0'

    def array(values):
        return tuple(positive(value, f'{arg}[{i}]') for i, value in enumerate(values))

    def byte_branches(values):
        result = []
        for i, item in enumerate(values):
            if item is None:
                result.append(None)
                continue
            byte, nat = item.value
            if byte == 0:
                refusal(f'{arg}[{i}]?.0', 'checkedByte')
            result.append(Some((byte, positive(nat, f'{arg}[{i}]?.1'))))
        return tuple(result)

    def nested(values):
        for i, row in enumerate(values):
            for j, item in enumerate(row):
                if item is not None:
                    bound(item.value[1], f'{arg}[{i}][{j}]?.1', 184467440737095516170)
        for i, row in enumerate(values):
            for j, item in enumerate(row):
                if item is not None:
                    positive(item.value[0], f'{arg}[{i}][{j}]?.0')
        return len(values)

    def plain_fin(values):
        for i, item in enumerate(values):
            if item is not None:
                bound(item.value, f'{arg}[{i}]?', 10)
        return len(values)

    return SimpleNamespace(
        Some=Some, Ok=Ok, Err=Err, LeanBridgeError=LeanBridgeError,
        scalar=lambda value: positive(value, arg), arrays=array, lists=array, specialized=array,
        options=lambda item: None if item is None else Some(positive(item.value, arg + '?')),
        product=lambda item: (positive(item[0], arg + '.0'), word(item[1], arg + '.1')),
        branch=lambda item: Ok(positive(item.value, arg + '.ok')) if type(item) is Ok else Err(word(item.value, arg + '.error')),
        byte_branches=byte_branches, nested=nested, plain_fin=plain_fin,
        alias_pair=lambda pair: (group(pair[0], arg + '.0'), group(pair[1], arg + '.1', True)),
        alias_arguments=lambda left, right: group(left, arg) + group(right, prefix + '1', True),
    )


check = runpy.run_path(sys.argv[1])['check_structural_subtypes']
expected = {'checks': 4119, 'rejections': 1042, 'snapshotControls': 6}
assert check(make_api()) == expected
mutations = [
    ('scalar', lambda value: value),
    ('arrays', lambda values: tuple(values)),
    ('product', lambda item: (item[0], item[1].split('\0')[0])),
    ('alias_pair', lambda pair: (tuple(pair[0]), tuple(pair[1]))),
    ('nested', lambda rows: len(rows)),
    ('branch', lambda item: item),
]
controls = 0
for name, replacement in mutations:
    api = make_api()
    setattr(api, name, replacement)
    try:
        check(api)
    except AssertionError:
        controls += 1
    else:
        raise AssertionError('undetected mutant: ' + name)
for position in (0, 1):
    api = make_api()
    original_call = api.alias_arguments

    def mutate_input(left, right):
        if any(item is not None and item.value == 0 for item in right):
            (left if position == 0 else right)[0] = Some(999)
            # Preserve the expected first failing path despite the mutation.
            refusal(prefix + '1[0]?', 'normalizePositive')
        return original_call(left, right)

    api.alias_arguments = mutate_input
    try:
        check(api)
    except AssertionError:
        controls += 1
    else:
        raise AssertionError('undetected input mutation')
print(json.dumps({**expected, 'callerMutationControls': controls}, sort_keys=True))
