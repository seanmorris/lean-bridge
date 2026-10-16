"""Independent native Python nested checked-record caller; executions require an installed package."""
import dataclasses
import json
import sys


INPUTS = ('first', 'second', 'pair', 'in_array', 'in_list', 'in_option', 'in_product',
          'in_except', 'in_holder', 'in_choice', 'echo_array')
RESULTS = ('produce_option', 'produce_array')
REJECTED_BY = ' was rejected by NestedCheckedRecords.'


def check_nested_checked_records(api, result_only=False, rounds=256, parameter_prefix='arg'):
    if type(result_only) is not bool or type(rounds) is not int or not 1 <= rounds <= 1000:
        raise ValueError('Invalid nested caller options')
    if parameter_prefix not in ('arg', 'value'):
        raise ValueError('Invalid parameter prefix')
    checks = rejections = host_rejections = recoveries = snapshots = snapshot_controls = 0
    Packet, Some = api.Packet, api.Some
    fields = {Packet: ('digit', 'word'), Some: ('value',)}
    if not result_only:
        Ok, Err = api.Ok, api.Err
        fields.update({Ok: ('value',), Err: ('value',), api.Holder: ('packet', 'tag'),
                       api.ChoiceEmpty: (), api.ChoicePacket: ('value',)})

    def snapshot(value):
        kind = type(value)
        if value is None or kind in (bool, int, float):
            return (kind.__name__, value)
        if kind in (list, tuple):
            return (kind.__name__, tuple(snapshot(item) for item in value))
        if kind not in fields:
            raise AssertionError('Unexpected public value type: ' + repr(kind))
        names = fields[kind]
        if tuple(field.name for field in dataclasses.fields(value)) != names:
            raise AssertionError('Unexpected record fields: ' + kind.__name__)
        return (kind.__name__, tuple((name, snapshot(getattr(value, name))) for name in names))

    def check(condition, label):
        nonlocal checks
        if not condition:
            raise AssertionError('failed: ' + label)
        checks += 1

    def unchanged(name, args, before):
        nonlocal snapshots
        snapshots += 1
        check(snapshot(args) == before, name + ' inputs unchanged')

    def call(name, args, expected):
        before = snapshot(args)
        try:
            result = getattr(api, name)(*args)
        except Exception as error:
            raise AssertionError(name + ' unexpectedly raised ' + type(error).__name__ + ': ' + str(error)) from error
        check(snapshot(result) == snapshot(expected), name + ' exact result')
        unchanged(name, args, before)

    def refuse(name, args, expected):
        nonlocal rejections
        before = snapshot(args)
        try:
            getattr(api, name)(*args)
        except api.LeanBridgeError as error:
            check(error.status == 1 and str(error) == expected, 'exact refusal: ' + expected)
        else:
            raise AssertionError('Accepted invalid input: ' + expected)
        unchanged(name, args, before)
        rejections += 1

    def host_refuse(name, args, kinds, label):
        # Python conversion refusals precede Lean and never use the bridge error class.
        nonlocal host_rejections
        before = snapshot(args)
        try:
            getattr(api, name)(*args)
        except Exception as error:
            check(type(error) in kinds, name + ' host refusal class: ' + label)
        else:
            raise AssertionError('Accepted malformed input: ' + label)
        unchanged(name, args, before)
        host_rejections += 1

    for name in INPUTS:
        check(hasattr(api, name) != result_only, 'input export selection: ' + name)
    for name in RESULTS:
        check(hasattr(api, name), 'result export selection: ' + name)
    pairs = [(0, False), (1, 1.0), ([Packet(0, 1)], (Packet(0, 1),)),
             (Packet(0, 1), Packet(0, 2)), (Packet(0, 1), Packet(1, 1)),
             (Some(Packet(0, 1)), Some(Packet(0, 2))), (Some(Packet(0, 1)), None),
             (None, Some(None))]
    if not result_only:
        pairs += [(api.Holder(Packet(0, 1), 1), (Packet(0, 1), 1)),
                  (api.ChoiceEmpty(), None), (api.ChoicePacket(Packet(0, 1)), Some(Packet(0, 1)))]
    for left, right in pairs:
        check(snapshot(left) != snapshot(right), 'independent snapshot mutation')
        snapshot_controls += 1

    # Constructor-free results: 2^100 + round, with words one and two above it.
    call('produce_option', (0,), Some(Packet(0, 1)))
    call('produce_array', (0,), (Packet(0, 1), Packet(0, 2)))
    for round_ in range(rounds):
        value = 2**100 + round_
        call('produce_option', (value,), Some(Packet(0, value + 1)))
        call('produce_array', (value,), (Packet(0, value + 1), Packet(0, value + 2)))
    host_refuse('produce_option', (True,), (TypeError,), 'bool Nat')
    host_refuse('produce_option', (-1,), (ValueError,), 'negative Nat')
    host_refuse('produce_array', (1.0,), (TypeError,), 'float Nat')
    host_refuse('produce_array', (None,), (TypeError,), 'absent Nat')
    if result_only:
        return dict(checks=checks, rejections=rejections, hostRejections=host_rejections,
                    recoveries=recoveries, snapshots=snapshots, snapshotControls=snapshot_controls,
                    rounds=rounds)

    Holder, ChoiceEmpty, ChoicePacket = api.Holder, api.ChoiceEmpty, api.ChoicePacket
    p0, p1 = parameter_prefix + '0', parameter_prefix + '1'
    call('first', (Packet(2, 3),), 3)
    call('second', (Packet(7, 0),), 8)
    call('pair', (Packet(2, 3), Packet(7, 0)), 11)
    call('in_array', ([Packet(1, 2), Packet(3, 5)],), 7)
    call('in_array', ((Packet(1, 2), Packet(3, 5)),), 7)
    call('in_array', ([],), 0)
    call('in_list', ([Packet(1, 0), Packet(3, 100)],), 6)
    call('in_list', ((),), 0)
    call('in_option', (None,), 0)
    call('in_option', (Some(Packet(1, 2)),), 3)
    call('in_product', ((Packet(1, 2), Packet(3, 0)),), 6)
    call('in_except', (Ok(Packet(2, 9)),), 3)
    call('in_except', (Err(Packet(1, 2)),), 3)
    call('in_holder', (Holder(Packet(3, 1), 9),), 13)
    call('in_choice', (ChoiceEmpty(),), 0)
    call('in_choice', (ChoicePacket(Packet(2, 4)),), 5)
    call('echo_array', ([Packet(2, 3), Packet(1, 2**100)],), (Packet(2, 3), Packet(1, 2**100)))
    call('echo_array', ((),), ())

    # Exact late-field and constructor paths through every carrier.
    refuse('first', (Packet(0, 0),), p0 + '.word' + REJECTED_BY + 'mkWord')
    refuse('first', (Packet(4, 2),), p0 + REJECTED_BY + 'mkPacket')
    refuse('first', (Packet(10, 12),), p0 + '.digit is not below its Fin 10 bound')
    refuse('pair', (Packet(2, 3), Packet(10, 0)), p1 + '.digit is not below its Fin 10 bound')
    refuse('in_array', ([Packet(2, 3), Packet(1, 0)],), p0 + '[1].word' + REJECTED_BY + 'mkWord')
    refuse('in_array', ([Packet(2, 3), Packet(5, 2)],), p0 + '[1]' + REJECTED_BY + 'mkPacket')
    refuse('in_array', ((Packet(2, 3), Packet(10, 12)),), p0 + '[1].digit is not below its Fin 10 bound')
    refuse('in_option', (Some(Packet(5, 2)),), p0 + '?' + REJECTED_BY + 'mkPacket')
    refuse('in_product', ((Packet(1, 2), Packet(10, 0)),), p0 + '.1.digit is not below its Fin 10 bound')
    refuse('in_except', (Ok(Packet(10, 0)),), p0 + '.ok.digit is not below its Fin 10 bound')
    refuse('in_except', (Err(Packet(3, 1)),), p0 + '.error' + REJECTED_BY + 'mkPacket')
    refuse('in_holder', (Holder(Packet(10, 0), 9),), p0 + '.packet.digit is not below its Fin 10 bound')
    refuse('in_choice', (ChoicePacket(Packet(3, 1)),), p0 + '.packet.value' + REJECTED_BY + 'mkPacket')

    # Malformed Python values are host refusals, distinct from Lean rejections.
    shape = (TypeError, ValueError)
    host_refuse('first', (Holder(Packet(2, 3), 1),), shape, 'holder as packet')
    host_refuse('first', (Packet(True, 3),), (TypeError,), 'bool digit')
    host_refuse('first', (Packet(2, -3),), (ValueError,), 'negative word')
    host_refuse('first', (Packet(2, 3.0),), (TypeError,), 'float word')
    host_refuse('in_array', (Packet(2, 3),), shape, 'packet as array')
    host_refuse('in_array', ([Packet(2, 3), (2, 3)],), shape, 'tuple as packet element')
    host_refuse('in_product', ([Packet(1, 2), Packet(3, 0)],), shape, 'list as product')
    host_refuse('in_option', (Packet(2, 3),), shape, 'bare packet as option')
    host_refuse('in_except', (Packet(2, 3),), shape, 'bare packet as result')
    host_refuse('in_holder', (Holder(Packet(2, 3), -1),), (ValueError,), 'negative tag')
    host_refuse('in_choice', (Packet(2, 4),), shape, 'packet as choice')

    # Rejection never poisons later calls: each refusal is followed by a success.
    for round_ in range(rounds):
        call('first', (Packet(round_ % 10, round_ + 10),), round_ + 10)
        refuse('first', (Packet(2, 1),), p0 + REJECTED_BY + 'mkPacket')
        call('second', (Packet(round_ % 10, 0),), round_ % 10 + 1)
        refuse('in_array', ([Packet(round_ % 10, round_ + 10), Packet(1, 0)],), p0 + '[1].word' + REJECTED_BY + 'mkWord')
        call('in_array', ([Packet(round_ % 10, round_ + 10), Packet(2, 3)],), round_ + 13)
        recoveries += 1
    return dict(checks=checks, rejections=rejections, hostRejections=host_rejections,
                recoveries=recoveries, snapshots=snapshots, snapshotControls=snapshot_controls,
                rounds=rounds)


if __name__ == '__main__':
    import lean_nestedcheckedrecords as installed
    print(json.dumps(check_nested_checked_records(installed, '--result-only' in sys.argv,
                                                  parameter_prefix='value' if '--reviewed' in sys.argv else 'arg'),
                     sort_keys=True))
