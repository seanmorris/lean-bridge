"""Independent installed Python checks for nominal Subtypes and copied results."""
import dataclasses
import json
import sys


INPUTS = ('first', 'second', 'combine', 'nested', 'event_first', 'event_second',
          'echo', 'aliases', 'inspect_alias_pair', 'echo_groups', 'echo_pair',
          'echo_event', 'plain_fin')


def check_nominal_subtypes(api, result_only=False):
    checks = rejections = snapshot_controls = 0
    Some, Ok, Err = api.Some, api.Ok, api.Err
    Envelope, AliasPair = api.Envelope, api.AliasPair
    Empty, Box, Choices = api.EventEmpty, api.EventBox, api.EventChoices
    for name in INPUTS:
        if hasattr(api, name) == result_only:
            raise AssertionError('incorrect input export selection: ' + name)
    fields = {Some: ('value',), Ok: ('value',), Err: ('value',),
              Envelope: ('payload', 'digit'), AliasPair: ('left', 'right'),
              Empty: (), Box: ('value',), Choices: ('values',)}
    if not result_only:
        fields[api.Pair] = ('left', 'right')

    def check(condition, label):
        nonlocal checks
        if not condition:
            raise AssertionError('failed: ' + label)
        checks += 1

    # Do not trust generated equality or serialization to compare public values.
    def snapshot(value):
        kind = type(value)
        if value is None or kind is int:
            return (kind.__name__, value)
        if kind in (list, tuple):
            return (kind.__name__, tuple(snapshot(item) for item in value))
        if kind not in fields:
            raise AssertionError('unexpected snapshot type: ' + repr(kind))
        names = fields[kind]
        if tuple(item.name for item in dataclasses.fields(value)) != names:
            raise AssertionError('unexpected record fields: ' + kind.__name__)
        return (kind.__name__, tuple((name, snapshot(getattr(value, name))) for name in names))

    def call(name, args, expected):
        before = snapshot(args)
        result = getattr(api, name)(*args)
        check(snapshot(result) == snapshot(expected), name + ' exact copied result')
        check(snapshot(args) == before, name + ' complete inputs unchanged')
        return result

    def refused(name, args, path, constructor=None, bound=None):
        nonlocal rejections
        before = snapshot(args)
        message = (path + ' is not below its Fin ' + str(bound) + ' bound'
                   if bound is not None else path + ' was rejected by NominalSubtypes.' + constructor)
        try:
            getattr(api, name)(*args)
        except api.LeanBridgeError as error:
            check(error.status == 1 and str(error) == message, 'exact refusal: ' + message + '; got ' + str(error))
        else:
            raise AssertionError('accepted: ' + message)
        check(snapshot(args) == before, name + ' rejected inputs unchanged')
        rejections += 1

    def box(value, digit=2):
        return Envelope(value, digit)

    def values(value):
        return (None, Some(box(value + 1)))

    huge = 2**100
    original = Choices((None, Some(Ok(huge))))
    for changed in (Choices((None, Some(Ok(huge + 1)))),
                    Choices((None, Some(Err(huge)))),
                    Choices((Some(Ok(huge)), None)), Choices((None, None)),
                    Choices((None, Some(Ok(huge)), None)), Box(box(huge)), Empty(),
                    Choices((None, Ok(Some(huge))))):
        check(snapshot(changed) != snapshot(original), 'independent snapshot mutation control')
        snapshot_controls += 1

    # Large copied outputs must not pass through either input constructor.
    for value in (0, 40, huge):
        one, two = value + 1, value + 2
        call('scalar', (value,), one)
        call('produce_envelope', (value,), box(one))
        call('array_values', (value,), (one, two))
        call('list_values', (value,), (one, two))
        call('optional', (value,), None if value == 0 else Some(one))
        call('product', (value,), (one, two))
        call('branch', (value,), Err(one) if value == 0 else Ok(one))
        call('group_values', (value,), values(value))
        call('pair_values', (value,), AliasPair(values(value), values(one)))
        call('event_value', (value,), Box(box(one)))
        call('event_empty', (value,), Empty())
        call('event_choices', (value,), Choices((None, Some(Ok(one)), Some(Err(two)))))
        call('no_items', (value,), ())
    if result_only:
        for round_ in range(1000):
            value = huge + round_
            call('pair_values', (value,), AliasPair(values(value), values(value + 1)))
        return {'checks': checks, 'rejections': rejections, 'snapshotControls': snapshot_controls}

    item = box(40)
    call('first', (item,), 41)
    call('second', (item,), 42)
    call('combine', (item, item), 4142)
    call('nested', (api.Pair(item, item),), 4142)
    call('first', (box(99),), 100)
    call('second', (box(89),), 91)
    call('first', (box(90),), 91)
    refused('first', (box(100),), 'arg0.payload', 'plusOne')
    refused('second', (box(90),), 'arg0.payload', 'plusTwo')
    refused('combine', (box(100), item), 'arg0.payload', 'plusOne')
    refused('combine', (item, box(90)), 'arg1.payload', 'plusTwo')
    refused('nested', (api.Pair(box(100), item),), 'arg0.left.payload', 'plusOne')
    refused('nested', (api.Pair(item, box(90)),), 'arg0.right.payload', 'plusTwo')
    call('echo', (item,), box(41))
    for name, one, two in (('event_first', 1, 2), ('event_second', 2, 1)):
        call(name, (Empty(),), 0)
        call(name, (Box(item),), 40 + one)
        call(name, (Choices(()),), 0)
        call(name, (Choices((None,)),), 0)
        call(name, (Choices((None, Some(Ok(40)))),), 40 + one)
        call(name, (Choices((Some(Err(40)), None)),), 40 + two)
        for label, branch, amount in (('ok', Ok, one), ('error', Err, two)):
            for position in range(3):
                items = [Some(Ok(40)), None, Some(Err(40))]
                items[position] = Some(branch(100))
                refused(name, (Choices(items),), f'arg0.choices.values[{position}]?.{label}',
                        'plusOne' if amount == 1 else 'plusTwo')

    left, right = [None, Some(item), Some(box(1, 0))], [Some(box(2, 1)), None]
    normalized_left = (None, Some(box(41)), Some(box(2, 0)))
    normalized_right = (Some(box(4, 1)), None)
    call('aliases', (left, right), 47)
    call('inspect_alias_pair', (AliasPair(left, right),), 47)
    call('echo_groups', (left,), normalized_left)
    projected = call('echo_pair', (AliasPair(left, right),), AliasPair(normalized_left, normalized_right))
    call('echo_pair', (projected,), AliasPair((None, Some(box(42)), Some(box(3, 0))), (Some(box(6, 1)), None)))
    call('echo_event', (Choices((None, Some(Ok(40)), Some(Err(40)))),), Choices((None, Some(Ok(41)), Some(Err(42)))))
    call('echo_event', (Empty(),), Empty())
    call('echo_event', (Box(item),), Box(box(41)))
    call('echo_groups', ([],), ())
    call('echo_pair', (AliasPair([], [None]),), AliasPair((), (None,)))
    for position in range(3):
        bad = [Some(item), None, Some(item)]
        bad[position] = Some(box(100))
        refused('echo_groups', (bad,), f'arg0[{position}]?.payload', 'plusOne')
        refused('inspect_alias_pair', (AliasPair(bad, right),), f'arg0.left[{position}]?.payload', 'plusOne')
        refused('inspect_alias_pair', (AliasPair(left, bad),), f'arg0.right[{position}]?.payload', 'plusTwo')

    # Complete Fin checks precede any earlier failing Subtype constructor.
    refused('combine', (box(100), box(40, 3)), 'arg1.digit', bound=3)
    refused('nested', (api.Pair(box(100), box(40, 3)),), 'arg0.right.digit', bound=3)
    refused('aliases', ([Some(box(100))], [None, Some(box(40, 3))]), 'arg1[1]?.digit', bound=3)
    refused('echo_event', (Box(box(100, 3)),), 'arg0.box.value.digit', bound=3)
    call('plain_fin', (2,), 2)
    refused('plain_fin', (3,), 'arg0', bound=3)
    for round_ in range(1000):
        position = round_ % 3
        bad = [None, Some(box(1)), None]
        bad[position] = Some(box(90))
        refused('echo_pair', (AliasPair(left, bad),), f'arg0.right[{position}]?.payload', 'plusTwo')
        call('echo_pair', (AliasPair(left, right),), AliasPair(normalized_left, normalized_right))
    return {'checks': checks, 'rejections': rejections, 'snapshotControls': snapshot_controls}


if __name__ == '__main__':
    if sys.argv[1:] not in ([], ['--result-only']):
        raise SystemExit('usage: consumer.py [--result-only]')
    import lean_nominalsubtypes
    print(json.dumps(check_nominal_subtypes(lean_nominalsubtypes, bool(sys.argv[1:])), sort_keys=True))
