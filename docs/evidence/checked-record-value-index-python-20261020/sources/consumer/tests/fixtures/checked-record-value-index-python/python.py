"""Independent Python caller for proof-erased checked records with closed values."""
import dataclasses
import json
import sys


INPUTS = ('true_bool_index', 'false_bool_index', 'ab_string_index',
          'empty_string_index', 'unicode_string_index', 'empty_sized_index',
          'zero_nat_index', 'wide_nat_index')
RESULTS = ('produce_true_bool', 'produce_false_bool', 'produce_ab',
           'produce_empty_string', 'produce_unicode_string', 'produce_empty_sized',
           'produce_zero_nat', 'produce_wide_nat')


def check_value_index_records(api, result_only=False, parameter_prefix='arg'):
    if type(result_only) is not bool or parameter_prefix not in ('arg', 'value'):
        raise ValueError('Invalid value-index caller options')
    checks = calls = rejections = recoveries = snapshots = 0
    classes = {name: getattr(api, name) for name in
               ('On', 'Off', 'Ab', 'EmptyToken', 'UnicodeToken', 'EmptySized',
                'ZeroToken', 'WideToken')}

    def check(condition, label):
        nonlocal checks
        if not condition:
            raise AssertionError('value-index assertion failed: ' + label)
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

    def refuse(name, args, constructor, label):
        nonlocal calls, rejections, snapshots
        before = snapshot(args)
        calls += 1
        try:
            getattr(api, name)(*args)
        except api.LeanBridgeError as error:
            check(error.status == 1 and str(error).startswith(
                parameter_prefix + '0 was rejected by CheckedRecordValueIndices.' + constructor),
                  label + ' checked-record refusal')
        else:
            raise AssertionError('Accepted invalid value-index input: ' + label)
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
            raise AssertionError('Accepted malformed value-index input: ' + label)
        check(snapshot(args) == before, label + ' preserves rejected input')
        rejections += 1
        snapshots += 1

    for name in INPUTS:
        check(hasattr(api, name) != result_only, 'input export selection: ' + name)
    for name in RESULTS:
        check(hasattr(api, name), 'result export selection: ' + name)

    On, Off, Ab = classes['On'], classes['Off'], classes['Ab']
    EmptyToken, UnicodeToken = classes['EmptyToken'], classes['UnicodeToken']
    EmptySized, ZeroToken, WideToken = classes['EmptySized'], classes['ZeroToken'], classes['WideToken']
    huge = (1 << 128) + 1
    if not result_only:
        invoke('true_bool_index', (On(0),), 0)
        invoke('false_bool_index', (Off(1),), 1)
        invoke('ab_string_index', (Ab(2),), 2)
        invoke('empty_string_index', (EmptyToken(9),), 9)
        invoke('unicode_string_index', (UnicodeToken(10),), 10)
        invoke('empty_sized_index', (EmptySized(()),), 0)
        invoke('zero_nat_index', (ZeroToken(11),), 11)
        invoke('wide_nat_index', (WideToken(huge),), huge)
        refuse('ab_string_index', (Ab(1),), 'mkAb', 'String index')
        invoke('zero_nat_index', (ZeroToken(99),), 99); recoveries += 1
        refuse('empty_sized_index', (EmptySized((1,)),), 'mkEmptySized', 'Nat index')
        invoke('zero_nat_index', (ZeroToken(99),), 99); recoveries += 1
        refuse('true_bool_index', (On(1),), 'mkOn', 'true Bool index')
        invoke('zero_nat_index', (ZeroToken(99),), 99); recoveries += 1
        refuse('false_bool_index', (Off(0),), 'mkOff', 'false Bool index')
        invoke('zero_nat_index', (ZeroToken(99),), 99); recoveries += 1
        host_refuse('true_bool_index', (On(-1),), 'negative true Nat')
        invoke('zero_nat_index', (ZeroToken(99),), 99); recoveries += 1
        host_refuse('zero_nat_index', (ZeroToken(-1),), 'negative token Nat')
        invoke('zero_nat_index', (ZeroToken(99),), 99); recoveries += 1

    def produced(name, args, expected):
        nonlocal calls
        calls += 1
        check(snapshot(getattr(api, name)(*args)) == snapshot(expected), name + ' produced record')

    produced('produce_true_bool', (), On(0))
    produced('produce_false_bool', (), Off(1))
    produced('produce_ab', (), Ab(2))
    produced('produce_empty_string', (23,), EmptyToken(23))
    produced('produce_unicode_string', (24,), UnicodeToken(24))
    produced('produce_empty_sized', (), EmptySized(()))
    produced('produce_zero_nat', (25,), ZeroToken(25))
    produced('produce_wide_nat', (2**100 + 17,), WideToken(2**100 + 17))

    expected = (8, 24, 0, 0, 0) if result_only else (28, 64, 6, 6, 20)
    check((calls, checks, recoveries, rejections, snapshots) == expected,
          'exact caller totals')
    return dict(calls=calls, checks=checks, recoveries=recoveries,
                rejections=rejections, snapshots=snapshots)


if __name__ == '__main__':
    import lean_checkedrecordvalueindices as installed
    print(json.dumps(check_value_index_records(
        installed, '--result-only' in sys.argv,
        'value' if '--reviewed' in sys.argv else 'arg'), sort_keys=True))
