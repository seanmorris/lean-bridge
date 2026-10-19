"""Run the immutable value-index Python caller against an explicit contract oracle."""
import dataclasses
import importlib.util
import json
import sys
from types import SimpleNamespace


if len(sys.argv) != 2:
    raise ValueError('Expected value-index caller path')
spec = importlib.util.spec_from_file_location('value_index_caller', sys.argv[1])
caller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(caller)


class LeanBridgeError(RuntimeError):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


On, Off, Ab = (dataclasses.make_dataclass(name, [('count' if name != 'Ab' else 'size', object)], frozen=True)
               for name in ('On', 'Off', 'Ab'))
EmptyToken = dataclasses.make_dataclass('EmptyToken', [('count', object)], frozen=True)
UnicodeToken = dataclasses.make_dataclass('UnicodeToken', [('count', object)], frozen=True)
EmptySized = dataclasses.make_dataclass('EmptySized', [('data', object)], frozen=True)
ZeroToken = dataclasses.make_dataclass('ZeroToken', [('count', object)], frozen=True)
WideToken = dataclasses.make_dataclass('WideToken', [('count', object)], frozen=True)


def natural(value):
    if type(value) is not int:
        raise TypeError('Expected exact Python int')
    if value < 0:
        raise ValueError('Negative Nat')
    return value


def checked(value, cls, field, predicate, constructor, prefix, fault):
    if type(value) is not cls:
        raise TypeError('Expected ' + cls.__name__)
    candidate = getattr(value, field)
    if field == 'data':
        if type(candidate) is not tuple:
            raise TypeError('Expected tuple')
        for item in candidate:
            natural(item)
    else:
        candidate = natural(candidate)
    if not predicate(candidate) and fault != 'accept-invalid':
        status = 2 if fault == 'wrong-status' else 1
        message_prefix = 'wrong' if fault == 'wrong-message' else prefix
        raise LeanBridgeError(status, message_prefix + '0 was rejected by CheckedRecordValueIndices.' + constructor)
    if fault == 'mutate-input' and field != 'data':
        object.__setattr__(value, field, candidate + 1)
    return candidate


def api(result_only, prefix, fault=None):
    values = dict(LeanBridgeError=LeanBridgeError, On=On, Off=Off, Ab=Ab,
                  EmptyToken=EmptyToken, UnicodeToken=UnicodeToken,
                  EmptySized=EmptySized, ZeroToken=ZeroToken, WideToken=WideToken)
    values.update(
        produce_true_bool=lambda: On(1 if fault == 'wrong-produced' else 0), produce_false_bool=lambda: Off(1),
        produce_ab=lambda: Ab(2), produce_empty_string=lambda value: EmptyToken(natural(value)),
        produce_unicode_string=lambda value: UnicodeToken(natural(value)),
        produce_empty_sized=lambda: EmptySized(()),
        produce_zero_nat=lambda value: ZeroToken(natural(value)),
        produce_wide_nat=lambda value: WideToken(natural(value)))
    if not result_only or fault == 'inputs-exported':
        values.update(
            true_bool_index=lambda value: checked(value, On, 'count', lambda n: n == 0, 'mkOn', prefix, fault),
            false_bool_index=lambda value: checked(value, Off, 'count', lambda n: n == 1, 'mkOff', prefix, fault),
            ab_string_index=lambda value: checked(value, Ab, 'size', lambda n: n == 2, 'mkAb', prefix, fault),
            empty_string_index=lambda value: checked(value, EmptyToken, 'count', lambda n: True, 'mkEmptyToken', prefix, fault),
            unicode_string_index=lambda value: checked(value, UnicodeToken, 'count', lambda n: True, 'mkUnicodeToken', prefix, fault),
            empty_sized_index=lambda value: len(checked(value, EmptySized, 'data', lambda data: type(data) is tuple and not data, 'mkEmptySized', prefix, fault)),
            zero_nat_index=lambda value: checked(value, ZeroToken, 'count', lambda n: True, 'mkZeroToken', prefix, fault),
            wide_nat_index=lambda value: checked(value, WideToken, 'count', lambda n: True, 'mkWideToken', prefix, fault))
    if fault == 'missing-producer':
        del values['produce_true_bool']
    return SimpleNamespace(**values)


results = []
for route, result_only, prefix in (
    ('ordinary-source', False, 'arg'), ('reviewed-ir', False, 'value'),
    ('result-only-ordinary-source', True, 'arg'), ('result-only-reviewed-ir', True, 'value')):
    results.append(dict(route=route, **caller.check_value_index_records(api(result_only, prefix), result_only, prefix)))

rejected = {}
for mode, result_only, faults in (
    ('full', False, ('accept-invalid', 'wrong-status', 'wrong-message', 'mutate-input', 'wrong-produced', 'missing-producer')),
    ('result-only', True, ('wrong-produced', 'missing-producer', 'inputs-exported'))):
    rejected[mode] = []
    for fault in faults:
        try:
            caller.check_value_index_records(api(result_only, 'arg', fault), result_only, 'arg')
        except AssertionError:
            rejected[mode].append(fault)
        else:
            raise AssertionError('Caller accepted fault: ' + fault)
print(json.dumps(dict(results=results, rejectedFaults=rejected), sort_keys=True))
