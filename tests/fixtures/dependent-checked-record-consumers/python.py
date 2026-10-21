"""Independent Python caller for a proof-erased dependent checked record."""
import dataclasses
import json
import sys


def check_dependent_records(api, result_only=False, parameter_prefix='arg'):
    if type(result_only) is not bool or parameter_prefix not in ('arg', 'value'):
        raise ValueError('Invalid dependent-record caller options')
    checks = calls = rejections = recoveries = snapshots = 0
    Dependent = api.Dependent

    def check(condition, label):
        nonlocal checks
        if not condition:
            raise AssertionError('dependent-record assertion failed: ' + label)
        checks += 1

    def snapshot(value):
        if type(value) in (int, str, bool, type(None)):
            return (type(value).__name__, value)
        if type(value) in (tuple, list):
            return (type(value).__name__, tuple(snapshot(item) for item in value))
        if type(value) is not Dependent:
            raise AssertionError('Unexpected public value: ' + repr(type(value)))
        return ('Dependent', tuple(
            (field.name, snapshot(getattr(value, field.name)))
            for field in dataclasses.fields(value)))

    def invoke(name, args, expected, label):
        nonlocal calls, snapshots
        before = snapshot(args)
        calls += 1
        value = getattr(api, name)(*args)
        check(snapshot(value) == snapshot(expected), label + ' exact result')
        check(snapshot(args) == before, label + ' preserves caller input')
        snapshots += 1
        return value

    def refuse(value, label):
        nonlocal calls, rejections, snapshots
        before = snapshot(value)
        calls += 1
        try:
            api.dependent_total(value)
        except api.LeanBridgeError as error:
            check(error.status == 1 and str(error).startswith(
                parameter_prefix + '0 was rejected by DependentRecords.mkDependent'),
                label + ' exact checked-record refusal')
            check(True, label + ' refuses invalid input')
        else:
            raise AssertionError('Accepted invalid dependent record: ' + label)
        check(snapshot(value) == before, label + ' preserves rejected input')
        rejections += 1
        snapshots += 1

    check(hasattr(api, 'dependent_total') != result_only,
          'dependent_total export selection')
    check(hasattr(api, 'dependent_roundtrip') != result_only,
          'dependent_roundtrip export selection')
    check(hasattr(api, 'dependent_result'), 'dependent_result export selection')

    def produced(seed, label):
        nonlocal calls, snapshots
        calls += 1
        value = api.dependent_result(seed)
        check(snapshot(value) == snapshot(Dependent(seed + 1, seed)),
              label + ' exact result')
        snapshots += 1

    for index in range(512):
        produced(index, 'result ' + str(index))
    huge = 1 << 130
    produced(huge, 'huge result')

    if not result_only:
        def recover():
            nonlocal recoveries
            invoke('dependent_total', (Dependent(2, 1),), 3, 'recovery')
            recoveries += 1

        invoke('dependent_total', (Dependent(3, 2),), 5, 'valid total')
        refuse(Dependent(2, 2), 'equal fields')
        recover()
        refuse(Dependent(0, 0), 'zero bound')
        recover()
        valid = Dependent(3, 2)
        invoke('dependent_roundtrip', (valid,), valid, 'roundtrip')
        below = huge - 1
        invoke('dependent_total', (Dependent(huge, below),), huge + below,
               'huge total')
        huge_record = Dependent(huge, below)
        invoke('dependent_roundtrip', (huge_record,), huge_record,
               'huge roundtrip')
        for index in range(256):
            bound = index + 1
            invoke('dependent_total', (Dependent(bound, index),), 2 * index + 1,
                   'loop total ' + str(index))
            refuse(Dependent(bound, bound), 'loop refusal ' + str(index))
            recover()

    expected = ((513, 516, 0, 0, 513) if result_only
                else (1289, 2326, 258, 258, 1289))
    if (calls, checks, recoveries, rejections, snapshots) != expected:
        raise AssertionError('dependent-record exact caller totals')
    return dict(calls=calls, checks=checks, recoveries=recoveries,
                rejections=rejections, snapshots=snapshots)


if __name__ == '__main__':
    import lean_dependentrecords as installed
    print(json.dumps(check_dependent_records(
        installed, '--result-only' in sys.argv,
        'value' if '--reviewed' in sys.argv else 'arg'), sort_keys=True))
