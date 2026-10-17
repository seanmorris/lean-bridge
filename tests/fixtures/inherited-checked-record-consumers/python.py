"""Independent Python caller for proof-free inherited checked records."""
import dataclasses
import json
import sys


FULL_NAMES = ('first', 'normalized', 'pair', 'aliased', 'nested', 'echo')
RESULT_NAMES = ('produce', 'produce_stamped')
REJECTED_BY = ' was rejected by InheritedCheckedRecords.'


def check_inherited_checked_records(api, result_only=False, rounds=256,
                                    parameter_prefix='arg'):
    """Exercise every inherited constructor site without generated metadata."""
    if type(result_only) is not bool or type(rounds) is not int or not 1 <= rounds <= 1000:
        raise ValueError('Invalid inherited caller options')
    if parameter_prefix not in ('arg', 'value'):
        raise ValueError('Invalid parameter prefix')
    checks = rejections = host_rejections = calls = 0
    recoveries = snapshots = snapshot_controls = 0
    Span, Ticket, Stamped = api.Span, api.Ticket, api.Stamped
    fields = {
        Span: ('lo', 'hi'), Ticket: ('to_span', 'word'),
        Stamped: ('to_ticket', 'mark')
    }

    def snapshot(value):
        kind = type(value)
        if kind in (type(None), bool, int, float, str):
            return (kind.__name__, value)
        if kind in (list, tuple):
            return (kind.__name__, tuple(snapshot(item) for item in value))
        if kind not in fields:
            raise AssertionError('Unexpected public value type: ' + repr(kind))
        names = fields[kind]
        if tuple(field.name for field in dataclasses.fields(value)) != names:
            raise AssertionError('Unexpected inherited record fields: ' + kind.__name__)
        return (kind.__name__, tuple(
            (name, snapshot(getattr(value, name))) for name in names
        ))

    def check(condition, label):
        nonlocal checks
        if not condition:
            raise AssertionError('failed: ' + label)
        checks += 1

    def equal(actual, expected, label):
        check(snapshot(actual) == snapshot(expected), label)

    def invoke(name, arguments, expected, label=None):
        nonlocal calls, snapshots
        before = snapshot(arguments)
        calls += 1
        try:
            result = getattr(api, name)(*arguments)
        except Exception as error:
            raise AssertionError(
                name + ' unexpectedly raised ' + type(error).__name__ + ': ' + str(error)
            ) from error
        equal(result, expected, label or name)
        check(snapshot(arguments) == before, (label or name) + ' preserved every input')
        snapshots += 1
        return result

    def refused(name, arguments, message):
        nonlocal calls, rejections, snapshots
        before = snapshot(arguments)
        calls += 1
        try:
            getattr(api, name)(*arguments)
        except Exception as error:
            check(type(error) is api.LeanBridgeError
                  and error.status == 1 and str(error) == message,
                  'exact refusal: ' + message)
        else:
            raise AssertionError('Accepted invalid input: ' + message)
        check(snapshot(arguments) == before, name + ' rejection preserved every input')
        snapshots += 1
        rejections += 1

    def host_refused(name, arguments, kinds, label):
        nonlocal calls, host_rejections, snapshots
        before = snapshot(arguments)
        calls += 1
        try:
            getattr(api, name)(*arguments)
        except Exception as error:
            check(type(error) in kinds and type(error) is not api.LeanBridgeError,
                  name + ' host refusal class: ' + label)
        else:
            raise AssertionError('Accepted malformed input: ' + label)
        check(snapshot(arguments) == before, label + ' preserved every input')
        snapshots += 1
        host_rejections += 1

    def distinct(left, right):
        nonlocal snapshot_controls
        check(snapshot(left) != snapshot(right), 'independent snapshot mutation control')
        snapshot_controls += 1

    def span(lo, hi):
        return Span(lo, hi)

    def ticket(lo, hi, word):
        return Ticket(span(lo, hi), word)

    def stamped(lo, hi, word, mark):
        return Stamped(ticket(lo, hi, word), mark)

    def produced(value):
        return ticket(value, value, value + 1)

    def produced_stamped(value):
        return stamped(value, value, value + 1, 0)

    for name in FULL_NAMES:
        check(hasattr(api, name) != result_only, 'full export selection: ' + name)
    for name in RESULT_NAMES:
        check(hasattr(api, name), 'result export selection: ' + name)

    huge = 2**100
    distinct(ticket(0, 0, 1), ticket(0, 0, 2))
    distinct(ticket(0, 0, 1), ticket(0, 1, 1))
    distinct(stamped(0, 0, 1, 0), stamped(0, 0, 1, 1))
    distinct(0, huge)
    distinct(span(0, 1), ticket(0, 1, 1))
    distinct(ticket(0, 1, 1), stamped(0, 1, 1, 0))
    if not result_only:
        distinct(ticket(1, 2, 3), ticket(2, 2, 3))
        distinct(stamped(1, 2, 3, 0), stamped(1, 2, 3, 7))

    for value in (0, 4, huge):
        invoke('produce', (value,), produced(value))
        invoke('produce_stamped', (value,), produced_stamped(value))
    for round_ in range(rounds):
        value = huge + round_
        first_result = invoke('produce', (value,), produced(value))
        marked_result = invoke('produce_stamped', (value,), produced_stamped(value))
        check(first_result is not marked_result.to_ticket,
              'returned tickets own independent managed storage')
        check(first_result.to_span is not marked_result.to_ticket.to_span,
              'returned parent fields own independent managed storage')
    host_refused('produce', (True,), (TypeError,), 'bool Nat')
    host_refused('produce', (-1,), (ValueError,), 'negative Nat')
    host_refused('produce_stamped', (1.0,), (TypeError,), 'float Nat')
    host_refused('produce_stamped', (None,), (TypeError,), 'absent Nat')
    if result_only:
        return dict(
            checks=checks, rejections=rejections, hostRejections=host_rejections,
            calls=calls, recoveries=recoveries, snapshots=snapshots,
            snapshotControls=snapshot_controls, rounds=rounds
        )

    p0 = parameter_prefix + '0'

    def rejected(path, constructor):
        return path + REJECTED_BY + constructor

    first_value = ticket(2, 3, 4)
    raw_right = ticket(4, 1, 999)
    invoke('first', (first_value,), 9)
    invoke('normalized', (ticket(4, 1, 0),), 11)
    invoke('pair', (first_value, raw_right), 10)
    invoke('aliased', (ticket(4, 1, 4),), 5)
    invoke('nested', (stamped(1, 2, 4, 3),), 7)
    invoke('echo', (ticket(1, 2, 0),), ticket(1, 2, 3))
    refused('first', (ticket(4, 1, 5),), rejected(p0 + '.toSpan', 'mkSpan'))
    refused('first', (ticket(1, 2, 0),), rejected(p0 + '.word', 'mkWord'))
    refused('first', (ticket(1, 5, 3),), rejected(p0, 'mkTicket'))
    refused('nested', (stamped(1, 2, 9, 8),),
            p0 + '.mark is not below its Fin 8 bound')
    refused('nested', (stamped(1, 2, 4, 5),), rejected(p0, 'mkStamped'))
    refused('aliased', (ticket(1, 5, 3),), rejected(p0, 'mkTicket'))
    refused('pair', (ticket(4, 1, 5), raw_right),
            rejected(p0 + '.toSpan', 'mkSpan'))
    refused('pair', (ticket(1, 5, 3), raw_right), rejected(p0, 'mkTicket'))
    host_refused('first', (1,), (TypeError, ValueError), 'unrelated scalar as Ticket')
    host_refused('first', (span(1, 2),), (TypeError, ValueError), 'Span as Ticket')
    host_refused('nested', (ticket(1, 2, 4),),
                 (TypeError, ValueError), 'Ticket as Stamped')
    equal(raw_right, ticket(4, 1, 999), 'normalization never mutated reused input')

    for round_ in range(rounds):
        value = round_ + 10
        valid = ticket(value, value + 1, value + 2)
        invoke('first', (valid,), 3 * value + 3, 'round accepted')
        invoke('normalized', (ticket(value + 2, value, 0),),
               4 * value + 5, 'round normalized')
        invoke('pair', (valid, ticket(value + 2, value, 0)),
               3 * value + 5, 'round repeated position')
        invoke('aliased', (ticket(value + 2, value, 2 * value + 1),),
               2 * value + 2, 'round alias')
        mark = round_ % 8
        invoke('nested', (stamped(mark, mark, mark + 1, mark),),
               2 * mark + 1, 'round nested')
        refused('first', (ticket(value + 1, value, value + 2),),
                rejected(p0 + '.toSpan', 'mkSpan'))
        refused('first', (ticket(0, 1, 0),), rejected(p0 + '.word', 'mkWord'))
        refused('first', (ticket(0, value + 2, value + 1),),
                rejected(p0, 'mkTicket'))
        refused('nested', (stamped(0, 9, 9, 8),),
                p0 + '.mark is not below its Fin 8 bound')
        refused('nested', (stamped(0, 6, 6, 7),), rejected(p0, 'mkStamped'))
        invoke('first', (valid,), 3 * value + 3, 'recovery after nested rejection')
        recoveries += 1
    equal(raw_right, ticket(4, 1, 999), 'all rounds preserved reused input')
    return dict(
        checks=checks, rejections=rejections, hostRejections=host_rejections,
        calls=calls, recoveries=recoveries, snapshots=snapshots,
        snapshotControls=snapshot_controls, rounds=rounds
    )


if __name__ == '__main__':
    import lean_inheritedcheckedrecords as installed
    print(json.dumps(check_inherited_checked_records(
        installed, '--result-only' in sys.argv,
        parameter_prefix='value' if '--reviewed' in sys.argv else 'arg'
    ), sort_keys=True))
