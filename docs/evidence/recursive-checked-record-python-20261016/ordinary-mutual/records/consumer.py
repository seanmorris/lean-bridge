"""Independent recursive and mutual checked-record caller; executions require an installed package."""
import dataclasses
import json
import sys


EXPORTS = ('first', 'second', 'echo', 'groups', 'echo_groups', 'produce')
MODULES = {
    'recursive': ('RecursiveCheckedRecords', 'Packet', ('value', 'digit', 'tail'),
                  'mkPacket', 'normalizePacket', '.digit', '.tail?'),
    'mutual': ('MutualCheckedRecords', 'Envelope', ('value', 'mode', 'next'),
               'mkEnvelope', 'normalizeEnvelope', '.mode', '.next?.more.packet'),
}


def check_recursive_checked_records(api, module, rounds=64):
    if module not in MODULES or type(rounds) is not int or not 1 <= rounds <= 1000:
        raise ValueError('Invalid recursive caller options')
    lean, record, names, make, normalize, bound, link = MODULES[module]
    Record, Some = getattr(api, record), api.Some
    rejected = ' was rejected by ' + lean + '.'
    fields = {Record: names, Some: ('value',)}
    if module == 'mutual':
        Stop, More = api.StepStop, api.StepMore
        fields.update({Stop: (), More: ('packet',)})
    checks = rejections = host_rejections = recoveries = snapshots = snapshot_controls = 0

    def node(value, digit, tail=None):
        # The only module difference is how a present child is carried.
        if tail is None or module == 'recursive':
            return Record(value, digit, None if tail is None else Some(tail))
        return Record(value, digit, Some(More(tail)))

    def chain(values):
        result = None
        for value, digit in reversed(values):
            result = node(value, digit, result)
        return result

    def stop(value, digit):
        return Record(value, digit, Some(Stop())) if module == 'mutual' else node(value, digit)

    def normalized(value, plus):
        # first/echo/groups select plus-one checks; second/echo_groups plus-two.
        kind = type(value)
        if value is None:
            return None
        if kind is Some:
            return Some(normalized(value.value, plus))
        if module == 'mutual' and kind is Stop:
            return Stop()
        if module == 'mutual' and kind is More:
            return More(normalized(value.packet, plus))
        head, digit, tail = (getattr(value, name) for name in names)
        if plus == 2 and module == 'recursive':
            return Record(digit + 1, digit, normalized(tail, plus))
        return Record(head + plus, digit, normalized(tail, plus))

    def snapshot(value, active=()):
        kind = type(value)
        if value is None or kind in (bool, int, float):
            return (kind.__name__, value)
        if id(value) in active:
            return ('cycle',)
        if kind in (list, tuple):
            return (kind.__name__, tuple(snapshot(item, active + (id(value),)) for item in value))
        if kind not in fields:
            raise AssertionError('Unexpected public value type: ' + repr(kind))
        if tuple(field.name for field in dataclasses.fields(value)) != fields[kind]:
            raise AssertionError('Unexpected record fields: ' + kind.__name__)
        return (kind.__name__, tuple((name, snapshot(getattr(value, name), active + (id(value),)))
                                     for name in fields[kind]))

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
        return result

    def refuse(name, args, expected):
        nonlocal rejections
        before = snapshot(args)
        try:
            getattr(api, name)(*args)
        except api.LeanBridgeError as error:
            check(type(error) is api.LeanBridgeError and error.status == 1 and str(error) == expected,
                  'exact refusal: ' + expected + ' (got ' + type(error).__name__ + ' '
                  + str(getattr(error, 'status', None)) + ': ' + str(error) + ')')
        else:
            raise AssertionError('Accepted invalid input: ' + expected)
        unchanged(name, args, before)
        rejections += 1

    def host_refuse(name, args, kinds, label, message=None):
        # Python conversion refusals precede the adapter and never use the bridge error class.
        nonlocal host_rejections
        before = snapshot(args)
        try:
            getattr(api, name)(*args)
        except Exception as error:
            check(isinstance(error, kinds) and not isinstance(error, api.LeanBridgeError),
                  name + ' host refusal class: ' + label)
            check(message is None or str(error) == message, name + ' host refusal text: ' + label)
        else:
            raise AssertionError('Accepted malformed input: ' + label)
        unchanged(name, args, before)
        host_rejections += 1

    for name in EXPORTS:
        check(callable(getattr(api, name, None)), 'export: ' + name)
    check(getattr(api, record + 'Alias') is Record, 'alias keeps the record class')
    pairs = [(0, False), (1, 1.0), ([node(1, 0)], (node(1, 0),)),
             (node(1, 0), node(1, 1)), (node(1, 0), node(2, 0)),
             (node(1, 0, node(1, 0)), node(1, 0)), (Some(node(1, 0)), None),
             (chain([(1, 0), (1, 0)]), chain([(1, 0), (2, 0)]))]
    if module == 'mutual':
        pairs += [(stop(1, 0), node(1, 0)), (Some(Stop()), None), (More(node(1, 0)), Some(node(1, 0)))]
    for left, right in pairs:
        check(snapshot(left) != snapshot(right), 'independent snapshot mutation')
        snapshot_controls += 1

    # Constructor-free results: two linked records, words one and two above the input.
    for value in (0, 5) + tuple(2**100 + round_ for round_ in range(rounds)):
        call('produce', (value,), chain([(value + 1, 1), (value + 2, 2)]))
    host_refuse('produce', (True,), (TypeError,), 'bool Nat')
    host_refuse('produce', (-1,), (ValueError,), 'negative Nat')
    host_refuse('produce', (1.0,), (TypeError,), 'float Nat')

    # Every linked record passes its selected constructors before the outer one.
    root = chain([(40, 2), (80, 1)])
    call('first', (root,), 41)
    call('first', (node(0, 1),), 1)
    call('first', (chain([(99, 2), (0, 0), (7, 1)]),), 100)
    call('second', (root,), 3 if module == 'recursive' else 42)
    call('second', (chain([(89, 2), (0, 1)]),), 3 if module == 'recursive' else 91)
    call('echo', (root,), normalized(root, 1))
    call('echo', (chain([(1, 0), (2, 1), (3, 2), (4, 0)]),), normalized(chain([(1, 0), (2, 1), (3, 2), (4, 0)]), 1))
    deep = chain([(n % 90, n % 3) for n in range(40)])
    call('first', (deep,), 1)
    call('echo', (deep,), normalized(deep, 1))
    call('second', (deep,), 1 if module == 'recursive' else 2)
    shared = node(5, 1)
    call('groups', ([Some(shared), None, Some(shared)],), 3)
    call('groups', ((),), 0)
    call('groups', ((None, Some(root)),), 2)
    call('echo_groups', ([Some(root), None, Some(shared)],),
         (normalized(Some(root), 2), None, normalized(Some(shared), 2)))
    call('echo_groups', ([],), ())
    if module == 'mutual':
        call('first', (stop(40, 2),), 41)
        call('echo', (stop(40, 2),), stop(41, 2))
        call('echo', (node(1, 0, stop(2, 1)),), node(2, 0, stop(3, 1)))
        call('second', (node(1, 0, stop(2, 1)),), 3)

    # Exact late-field and constructor paths through the recursive carrier.
    refuse('first', (node(100, 0),), 'arg0.value' + rejected + 'plusOne')
    refuse('first', (node(2**100, 0),), 'arg0.value' + rejected + 'plusOne')
    refuse('first', (chain([(40, 2), (100, 1)]),), 'arg0' + link + '.value' + rejected + 'plusOne')
    refuse('first', (chain([(40, 2), (40, 2), (100, 1)]),),
           'arg0' + link + link + '.value' + rejected + 'plusOne')
    refuse('first', (node(40, 3),), 'arg0' + bound + ' is not below its Fin 3 bound')
    refuse('first', (chain([(40, 2), (80, 3)]),), 'arg0' + link + bound + ' is not below its Fin 3 bound')
    refuse('first', (node(0, 2),), 'arg0' + rejected + make)
    refuse('first', (chain([(40, 2), (0, 2)]),), 'arg0' + link + rejected + make)
    refuse('echo', (chain([(40, 2), (0, 2)]),), 'arg0' + link + rejected + make)
    refuse('second', (node(90, 0),), 'arg0.value' + rejected + 'plusTwo')
    refuse('second', (chain([(1, 0), (90, 0)]),), 'arg0' + link + '.value' + rejected + 'plusTwo')
    refuse('groups', ([None, Some(node(100, 0))],), 'arg0[1]?.value' + rejected + 'plusOne')
    refuse('groups', ([Some(root), Some(node(0, 2))],), 'arg0[1]?' + rejected + make)
    refuse('groups', ((Some(node(1, 3)),),), 'arg0[0]?' + bound + ' is not below its Fin 3 bound')
    refuse('echo_groups', ([Some(node(90, 0))],), 'arg0[0]?.value' + rejected + 'plusTwo')
    refuse('echo_groups', ([None, Some(chain([(1, 0), (95, 1)]))],),
           'arg0[1]?' + link + '.value' + rejected + 'plusTwo')

    # Malformed Python values are host refusals, distinct from adapter rejections.
    host_refuse('first', (Some(node(1, 0)),), (TypeError,), 'option as record')
    host_refuse('first', (node(True, 0),), (TypeError,), 'bool value')
    host_refuse('first', (node(1, -1),), (ValueError,), 'negative digit')
    host_refuse('first', (node(1.0, 0),), (TypeError,), 'float value')
    host_refuse('first', (Record(1, 0, node(1, 0)),), (TypeError,), 'bare child')
    host_refuse('groups', (node(1, 0),), (TypeError,), 'record as array')
    host_refuse('groups', ([node(1, 0)],), (TypeError,), 'bare record as option')
    host_refuse('echo_groups', ([Some(None)],), (TypeError,), 'absent record')
    if module == 'mutual':
        host_refuse('first', (Record(1, 0, Some(node(1, 0))),), (TypeError,), 'record as step')
        host_refuse('first', (Record(1, 0, Stop()),), (TypeError,), 'bare step')
    cyclic = node(1, 0)
    object.__setattr__(cyclic, names[2], Some(cyclic) if module == 'recursive' else Some(More(cyclic)))
    host_refuse('first', (cyclic,), (ValueError,), 'cycle', 'Cyclic Python copied value')
    host_refuse('groups', ([Some(cyclic)],), (ValueError,), 'cycle in group', 'Cyclic Python copied value')
    host_refuse('first', (chain([(1, 0)] * 100),), (ValueError,), 'depth', 'Copied graph depth or node limit exceeded')

    # Rejection never poisons later calls: each refusal is followed by a success.
    for round_ in range(rounds):
        value = round_ % 90
        call('first', (chain([(value, value % 3), (99 - value, 0)]),), value + 1)
        refuse('first', (chain([(value, value % 3), (100 + round_, 0)]),),
               'arg0' + link + '.value' + rejected + 'plusOne')
        call('second', (node(value, round_ % 3),), round_ % 3 + 1 if module == 'recursive' else value + 2)
        refuse('groups', ([Some(node(value, 0)), Some(node(0, 2))],), 'arg0[1]?' + rejected + make)
        host_refuse('first', (cyclic,), (ValueError,), 'cycle recovery', 'Cyclic Python copied value')
        call('groups', ([Some(node(value, 0))] * (round_ % 4),), round_ % 4)
        recoveries += 1
    return dict(checks=checks, rejections=rejections, hostRejections=host_rejections,
                recoveries=recoveries, snapshots=snapshots, snapshotControls=snapshot_controls,
                rounds=rounds, module=module)


if __name__ == '__main__':
    selected = sys.argv[1]
    if selected == 'recursive':
        import lean_recursivecheckedrecords as installed
    else:
        import lean_mutualcheckedrecords as installed
    print(json.dumps(check_recursive_checked_records(installed, selected), sort_keys=True))
