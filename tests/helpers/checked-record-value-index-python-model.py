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


def checked(value, cls, field, predicate, constructor, prefix):
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
    if not predicate(candidate):
        raise LeanBridgeError(1, prefix + '0 was rejected by CheckedRecordValueIndices.' + constructor)
    return candidate


def api(result_only, prefix):
    values = dict(LeanBridgeError=LeanBridgeError, On=On, Off=Off, Ab=Ab,
                  EmptyToken=EmptyToken, UnicodeToken=UnicodeToken,
                  EmptySized=EmptySized, ZeroToken=ZeroToken, WideToken=WideToken)
    values.update(
        produce_true_bool=lambda: On(0), produce_false_bool=lambda: Off(1),
        produce_ab=lambda: Ab(2), produce_empty_string=lambda value: EmptyToken(natural(value)),
        produce_unicode_string=lambda value: UnicodeToken(natural(value)),
        produce_empty_sized=lambda: EmptySized(()),
        produce_zero_nat=lambda value: ZeroToken(natural(value)),
        produce_wide_nat=lambda value: WideToken(natural(value)))
    if not result_only:
        values.update(
            true_bool_index=lambda value: checked(value, On, 'count', lambda n: n == 0, 'mkOn', prefix),
            false_bool_index=lambda value: checked(value, Off, 'count', lambda n: n == 1, 'mkOff', prefix),
            ab_string_index=lambda value: checked(value, Ab, 'size', lambda n: n == 2, 'mkAb', prefix),
            empty_string_index=lambda value: checked(value, EmptyToken, 'count', lambda n: True, 'mkEmptyToken', prefix),
            unicode_string_index=lambda value: checked(value, UnicodeToken, 'count', lambda n: True, 'mkUnicodeToken', prefix),
            empty_sized_index=lambda value: len(checked(value, EmptySized, 'data', lambda data: type(data) is tuple and not data, 'mkEmptySized', prefix)),
            zero_nat_index=lambda value: checked(value, ZeroToken, 'count', lambda n: True, 'mkZeroToken', prefix),
            wide_nat_index=lambda value: checked(value, WideToken, 'count', lambda n: True, 'mkWideToken', prefix))
    return SimpleNamespace(**values)


results = []
for route, result_only, prefix in (
    ('ordinary-source', False, 'arg'), ('reviewed-ir', False, 'value'),
    ('result-only-ordinary-source', True, 'arg'), ('result-only-reviewed-ir', True, 'value')):
    results.append(dict(route=route, **caller.check_value_index_records(api(result_only, prefix), result_only, prefix)))
print(json.dumps(results, sort_keys=True))
