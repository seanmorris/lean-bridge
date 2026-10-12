"""Synthetic caller controls only. No Lean or installed package executes here."""
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


@dataclass(frozen=True)
class Envelope:
    payload: int
    digit: int


@dataclass(frozen=True)
class Pair:
    left: object
    right: object


@dataclass(frozen=True)
class AliasPair:
    left: object
    right: object


@dataclass(frozen=True)
class EventEmpty:
    pass


@dataclass(frozen=True)
class EventBox:
    value: object


@dataclass(frozen=True)
class EventChoices:
    values: object


class LeanBridgeError(RuntimeError):
    def __init__(self, message):
        super().__init__(message)
        self.status = 1


prefix, mode = sys.argv[2:]
if prefix not in ('arg', 'value') or mode not in ('full', 'result-only'):
    raise AssertionError('invalid oracle selection')
result_only = mode == 'result-only'


def below(value, path):
    if value >= 3:
        raise LeanBridgeError(path + ' is not below its Fin 3 bound')


def fin_walk(value, path):
    kind = type(value)
    if kind is Envelope:
        below(value.digit, path + '.digit')
    elif kind in (Pair, AliasPair):
        fin_walk(value.left, path + '.left')
        fin_walk(value.right, path + '.right')
    elif kind is EventBox:
        fin_walk(value.value, path + '.box.value')
    elif kind is EventChoices:
        fin_walk(value.values, path + '.choices.values')
    elif kind in (list, tuple):
        for i, item in enumerate(value):
            fin_walk(item, f'{path}[{i}]')
    elif kind is Some:
        fin_walk(value.value, path + '?')
    elif kind in (Ok, Err):
        fin_walk(value.value, path + ('.ok' if kind is Ok else '.error'))


def payload(value, amount, path):
    if value >= (100 if amount == 1 else 90):
        raise LeanBridgeError(path + ' was rejected by NominalSubtypes.' + ('plusOne' if amount == 1 else 'plusTwo'))
    return value + amount


def envelope(value, amount, path):
    return Envelope(payload(value.payload, amount, path + '.payload'), value.digit)


def group(values, amount, path):
    return tuple(None if item is None else Some(envelope(item.value, amount, f'{path}[{i}]?')) for i, item in enumerate(values))


def event(value, one, two, path):
    if type(value) is EventEmpty:
        return EventEmpty()
    if type(value) is EventBox:
        return EventBox(envelope(value.value, one, path + '.box.value'))
    items = []
    for i, item in enumerate(value.values):
        if item is None:
            items.append(None)
        else:
            branch = item.value
            amount, label = (one, 'ok') if type(branch) is Ok else (two, 'error')
            items.append(Some(type(branch)(payload(branch.value, amount, f'{path}.choices.values[{i}]?.{label}'))))
    return EventChoices(tuple(items))


def group_sum(values):
    return sum(item.value.payload for item in values if item is not None)


def event_sum(value):
    if type(value) is EventEmpty:
        return 0
    if type(value) is EventBox:
        return value.value.payload
    return sum(item.value.value for item in value.values if item is not None)


def produced(value):
    return (None, Some(Envelope(value + 1, 2)))


def make_api():
    arg = prefix + '0'
    api = SimpleNamespace(Some=Some, Ok=Ok, Err=Err, Envelope=Envelope, AliasPair=AliasPair,
                          EventEmpty=EventEmpty, EventBox=EventBox, EventChoices=EventChoices,
                          LeanBridgeError=LeanBridgeError,
                          scalar=lambda n: n + 1, produce_envelope=lambda n: Envelope(n + 1, 2),
                          array_values=lambda n: (n + 1, n + 2), list_values=lambda n: (n + 1, n + 2),
                          optional=lambda n: None if n == 0 else Some(n + 1),
                          product=lambda n: (n + 1, n + 2), branch=lambda n: Err(1) if n == 0 else Ok(n + 1),
                          group_values=produced, pair_values=lambda n: AliasPair(produced(n), produced(n + 1)),
                          event_value=lambda n: EventBox(Envelope(n + 1, 2)), event_empty=lambda n: EventEmpty(),
                          event_choices=lambda n: EventChoices((None, Some(Ok(n + 1)), Some(Err(n + 2)))),
                          no_items=lambda n: ())
    if result_only:
        return api
    api.Pair = Pair
    functions = {
        'first': lambda value: envelope(value, 1, arg).payload,
        'second': lambda value: envelope(value, 2, arg).payload,
        'combine': lambda left, right: envelope(left, 1, arg).payload * 100 + envelope(right, 2, prefix + '1').payload,
        'nested': lambda pair: envelope(pair.left, 1, arg + '.left').payload * 100 + envelope(pair.right, 2, arg + '.right').payload,
        'event_first': lambda value: event_sum(event(value, 1, 2, arg)),
        'event_second': lambda value: event_sum(event(value, 2, 1, arg)),
        'echo': lambda value: envelope(value, 1, arg),
        'aliases': lambda left, right: group_sum(group(left, 1, arg)) + group_sum(group(right, 2, prefix + '1')),
        'inspect_alias_pair': lambda pair: group_sum(group(pair.left, 1, arg + '.left')) + group_sum(group(pair.right, 2, arg + '.right')),
        'echo_groups': lambda values: group(values, 1, arg),
        'echo_pair': lambda pair: AliasPair(group(pair.left, 1, arg + '.left'), group(pair.right, 2, arg + '.right')),
        'echo_event': lambda value: event(value, 1, 2, arg),
        'plain_fin': lambda value: (below(value, arg), value)[1],
    }

    def checked(fn):
        def call(*args):
            for i, value in enumerate(args):
                fin_walk(value, prefix + str(i))
            return fn(*args)
        return call

    for name, fn in functions.items():
        setattr(api, name, checked(fn))
    return api


check = runpy.run_path(sys.argv[1])['check_nominal_subtypes']
expected = {'checks': 2086 if result_only else 4212,
            'rejections': 0 if result_only else 1032, 'snapshotControls': 8}
if check(make_api(), result_only) != expected:
    raise AssertionError('caller count drift')
mutations = [('scalar', lambda n: n),
             ('produce_envelope', lambda n: Envelope(n & ((1 << 64) - 1), 2)),
             ('group_values', lambda n: list(produced(n))),
             ('pair_values', lambda n: AliasPair(produced(n), produced(n)))]
if result_only:
    mutations.append(('first', lambda n: n))
else:
    mutations.extend([('first', lambda value: value.payload),
                      ('second', lambda value: value.payload + 1),
                      ('event_second', lambda value: event_sum(event(value, 1, 2, prefix + '0'))),
                      ('echo', lambda value: Envelope(value.payload + 2, value.digit))])
controls = 0
for name, replacement in mutations:
    api = make_api()
    setattr(api, name, replacement)
    try:
        check(api, result_only)
    except AssertionError:
        controls += 1
    else:
        raise AssertionError('undetected mutant: ' + name)
if not result_only:
    for side in ('left', 'right'):
        api = make_api()
        original_call = api.echo_pair

        def mutate_rejected(pair):
            try:
                return original_call(pair)
            except LeanBridgeError:
                getattr(pair, side)[0] = Some(Envelope(999, 2))
                raise

        api.echo_pair = mutate_rejected
        try:
            check(api, False)
        except AssertionError:
            controls += 1
        else:
            raise AssertionError('undetected rejected input mutation: ' + side)
print(json.dumps({**expected, 'callerMutationControls': controls}, sort_keys=True))
