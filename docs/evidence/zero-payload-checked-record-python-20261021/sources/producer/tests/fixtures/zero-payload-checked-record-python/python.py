"""Independent Python caller for proof-erased zero-payload checked records."""
import dataclasses
import json
import sys


INPUTS = ('witness_count', 'absent_count', 'token_tag', 'marker_count', 'mark_count')
RESULTS = ('produce_witness', 'produce_token', 'witnesses', 'maybe_witness',
           'produce_marker', 'produce_mark')
CLASSES = ('Witness', 'Token', 'Marker', 'MarkBlank', 'MarkMarked', 'Some')


def check_zero_payload_records(api, result_only=False, parameter_prefix='arg'):
    if type(result_only) is not bool or parameter_prefix not in ('arg', 'value'):
        raise ValueError('Invalid zero-payload caller options')
    checks = calls = rejections = recoveries = snapshots = 0
    classes = {name: getattr(api, name) for name in CLASSES}

    def check(condition, label):
        nonlocal checks
        if not condition:
            raise AssertionError('zero-payload assertion failed: ' + label)
        checks += 1

    def snapshot(value):
        kind = type(value)
        if kind in (int, str, bool, type(None)):
            return (kind.__name__, value)
        if kind in (tuple, list):
            return (kind.__name__, tuple(snapshot(item) for item in value))
        if kind not in classes.values():
            raise AssertionError('Unexpected public value: ' + repr(kind))
        fields = tuple(field.name for field in dataclasses.fields(value))
        return (kind.__name__, tuple((name, snapshot(getattr(value, name))) for name in fields))

    def invoke(name, args, expected):
        nonlocal calls, snapshots
        before = snapshot(args)
        calls += 1
        result = getattr(api, name)(*args)
        check(snapshot(result) == snapshot(expected), name + ' exact result')
        check(snapshot(args) == before, name + ' preserves caller input')
        snapshots += 1
        return result

    def refuse(name, args, constructor, label):
        nonlocal calls, rejections, snapshots
        before = snapshot(args)
        calls += 1
        try:
            getattr(api, name)(*args)
        except api.LeanBridgeError as error:
            check(error.status == 1 and str(error).startswith(
                parameter_prefix + '0 was rejected by ZeroPayloadCheckedRecords.' + constructor),
                  label + ' checked-record refusal')
        else:
            raise AssertionError('Accepted refused zero-payload input: ' + label)
        check(snapshot(args) == before, label + ' preserves rejected input')
        rejections += 1
        snapshots += 1

    def host_refuse(name, args, label):
        nonlocal calls, rejections, snapshots
        before = snapshot(args)
        calls += 1
        try:
            getattr(api, name)(*args)
        except (TypeError, ValueError):
            check(True, label + ' host refusal')
        else:
            raise AssertionError('Accepted malformed zero-payload input: ' + label)
        check(snapshot(args) == before, label + ' preserves rejected input')
        rejections += 1
        snapshots += 1

    def recover():
        nonlocal recoveries
        invoke('witness_count', (Witness(),), 1)
        recoveries += 1

    for name in INPUTS:
        check(hasattr(api, name) != result_only, 'input export selection: ' + name)
    for name in RESULTS:
        check(hasattr(api, name), 'result export selection: ' + name)

    Witness, Token, Marker = classes['Witness'], classes['Token'], classes['Marker']
    MarkBlank, MarkMarked, Some = classes['MarkBlank'], classes['MarkMarked'], classes['Some']
    check(len(dataclasses.fields(Witness)) == 0 and len(dataclasses.fields(Marker)) == 0,
          'proof-only Witness and plain Marker carry no runtime field')
    check([field.name for field in dataclasses.fields(Token)] == ['tag'],
          'Token keeps its Unit payload field')
    check(Witness() != Marker() and Witness() != MarkBlank() and Witness() is not None,
          'empty carriers stay nominally distinct from each other and from None')

    witness = invoke('produce_witness', (), Witness())
    check(type(witness) is Witness and witness == Witness(), 'proof-only Witness is a real empty value')
    token = invoke('produce_token', (), Token(None))
    check(token.tag is None, 'Token retains its Unit payload')
    values = invoke('witnesses', (3,), (Witness(), Witness(), Witness()))
    check(type(values) is tuple and len(values) == 3 and values[0] == values[2],
          'Witness array retains its length')
    invoke('witnesses', (0,), ())
    invoke('maybe_witness', (False,), None)
    some = invoke('maybe_witness', (True,), Some(Witness()))
    check(type(some) is Some and some.value == Witness(), 'present empty Witness remains Some')
    marker = invoke('produce_marker', (), Marker())
    check(type(marker) is Marker and type(marker) is not type(witness),
          'plain Marker stays distinct from checked Witness')
    blank = invoke('produce_mark', (False,), MarkBlank())
    marked = invoke('produce_mark', (True,), MarkMarked(Witness()))
    check(type(blank) is MarkBlank and type(marked) is MarkMarked and marked.witness == Witness(),
          'both variant branches survive proof erasure')

    if not result_only:
        invoke('witness_count', (Witness(),), 1)
        refuse('absent_count', (Witness(),), 'mkAbsent', 'refusing nullary constructor')
        recover()
        invoke('token_tag', (Token(None),), None)
        invoke('marker_count', (Marker(),), 0)
        invoke('mark_count', (MarkBlank(),), 0)
        invoke('mark_count', (MarkMarked(Witness()),), 1)
        host_refuse('witness_count', (None,), 'None is not an empty carrier')
        recover()
        host_refuse('witness_count', (Marker(),), 'plain Marker is not a checked Witness')
        recover()
        host_refuse('marker_count', (Witness(),), 'checked Witness is not a plain Marker')
        recover()
        host_refuse('token_tag', (Token(0),), 'Unit payload must be None')
        recover()
        host_refuse('mark_count', (MarkMarked(None),), 'nested None is not an empty carrier')
        recover()
        host_refuse('mark_count', (Witness(),), 'bare Witness is not a Mark constructor')
        recover()
        host_refuse('witnesses', (-1,), 'negative Witness count')
        recover()

    expected = (9, 38, 0, 0, 9) if result_only else (30, 80, 8, 8, 30)
    actual = (calls, checks, recoveries, rejections, snapshots)
    check(actual == expected, 'exact caller totals ' + repr(actual) + ' != ' + repr(expected))
    return dict(calls=calls, checks=checks, recoveries=recoveries,
                rejections=rejections, snapshots=snapshots)


if __name__ == '__main__':
    import lean_zeropayloadcheckedrecords as installed
    print(json.dumps(check_zero_payload_records(
        installed, '--result-only' in sys.argv,
        'value' if '--reviewed' in sys.argv else 'arg'), sort_keys=True))
