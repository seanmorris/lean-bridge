"""Run the immutable dependent-record caller against an explicit contract oracle."""
import dataclasses
import importlib.util
import json
import sys
from types import SimpleNamespace


if len(sys.argv) != 2:
    raise ValueError('Expected dependent-record caller path')
spec = importlib.util.spec_from_file_location('dependent_record_caller', sys.argv[1])
caller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(caller)


class LeanBridgeError(RuntimeError):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


Dependent = dataclasses.make_dataclass(
    'Dependent', [('bound', object), ('below', object)], frozen=True)


def natural(value):
    if type(value) is not int:
        raise TypeError('Expected exact Python int')
    if value < 0:
        raise ValueError('Negative Nat')
    return value


def checked(value, prefix, fault):
    if type(value) is not Dependent:
        raise TypeError('Expected Dependent')
    bound, below = natural(value.bound), natural(value.below)
    if below >= bound and fault != 'accept-invalid':
        if fault == 'mutate-input':
            object.__setattr__(value, 'below', below + 1)
        status = 2 if fault == 'wrong-status' else 1
        message_prefix = 'wrong' if fault == 'wrong-message' else prefix
        raise LeanBridgeError(
            status, message_prefix + '0 was rejected by DependentRecords.mkDependent')
    return bound, below


def api(result_only, prefix, fault=None):
    values = dict(LeanBridgeError=LeanBridgeError, Dependent=Dependent)

    def dependent_result(seed):
        seed = natural(seed)
        return Dependent(seed + (2 if fault == 'wrong-produced' else 1), seed)

    values['dependent_result'] = dependent_result
    if not result_only or fault == 'inputs-exported':
        def dependent_total(value):
            bound, below = checked(value, prefix, fault)
            return bound + below

        def dependent_roundtrip(value):
            checked(value, prefix, fault)
            return Dependent(value.bound + 1, value.below) if fault == 'wrong-roundtrip' else value

        values.update(dependent_total=dependent_total,
                      dependent_roundtrip=dependent_roundtrip)
    if fault == 'missing-producer':
        del values['dependent_result']
    return SimpleNamespace(**values)


results = []
for route, result_only, prefix in (
        ('ordinary-source', False, 'arg'), ('reviewed-ir', False, 'value'),
        ('result-only-ordinary-source', True, 'arg'),
        ('result-only-reviewed-ir', True, 'value')):
    results.append(dict(
        route=route,
        **caller.check_dependent_records(api(result_only, prefix), result_only, prefix)))

rejected = {}
for mode, result_only, faults in (
        ('full', False, ('accept-invalid', 'wrong-status', 'wrong-message',
                         'mutate-input', 'wrong-produced', 'wrong-roundtrip',
                         'missing-producer')),
        ('result-only', True, ('wrong-produced', 'missing-producer',
                               'inputs-exported'))):
    rejected[mode] = []
    for fault in faults:
        try:
            caller.check_dependent_records(
                api(result_only, 'arg', fault), result_only, 'arg')
        except (AssertionError, AttributeError):
            rejected[mode].append(fault)
        else:
            raise AssertionError('Caller accepted fault: ' + fault)

print(json.dumps(dict(results=results, rejectedFaults=rejected), sort_keys=True))
