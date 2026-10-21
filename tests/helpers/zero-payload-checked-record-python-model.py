"""Run the immutable zero-payload Python caller against an explicit contract oracle."""
import dataclasses
import importlib.util
import json
import sys
from types import SimpleNamespace


if len(sys.argv) != 2:
    raise ValueError('Expected zero-payload caller path')
spec = importlib.util.spec_from_file_location('zero_payload_caller', sys.argv[1])
caller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(caller)


class LeanBridgeError(RuntimeError):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


Witness = dataclasses.make_dataclass('Witness', [], frozen=True)
Token = dataclasses.make_dataclass('Token', [('tag', object)], frozen=True)
Marker = dataclasses.make_dataclass('Marker', [], frozen=True)
MarkBlank = dataclasses.make_dataclass('MarkBlank', [], frozen=True)
MarkMarked = dataclasses.make_dataclass('MarkMarked', [('witness', object)], frozen=True)
Some = dataclasses.make_dataclass('Some', [('value', object)], frozen=True)


def exact(value, cls):
    if type(value) is not cls:
        raise TypeError('Expected ' + cls.__name__)
    return value


def unit(value):
    if value is not None:
        raise TypeError('Unit requires None')
    return value


def natural(value):
    if type(value) is not int:
        raise TypeError('Expected exact Python int')
    if value < 0:
        raise ValueError('Negative Nat')
    return value


def boolean(value):
    if type(value) is not bool:
        raise TypeError('Bool requires bool')
    return value


def api(result_only, prefix, fault=None):
    def witness_input(value):
        if fault == 'host-accepts-none' and value is None:
            return value
        return exact(value, Witness)

    def refused(value):
        witness_input(value)
        if fault == 'accept-invalid':
            return 0
        status = 2 if fault == 'wrong-status' else 1
        message_prefix = 'wrong' if fault == 'wrong-message' else prefix
        raise LeanBridgeError(status, message_prefix + '0 was rejected by ZeroPayloadCheckedRecords.mkAbsent')

    def mark_count(value):
        if type(value) is MarkBlank:
            return 0
        if type(value) is MarkMarked:
            exact(value.witness, Witness)
            return 1
        raise TypeError('Expected a named Mark constructor')

    values = dict(LeanBridgeError=LeanBridgeError, Witness=Witness, Token=Token, Marker=Marker,
                  MarkBlank=MarkBlank, MarkMarked=MarkMarked, Some=Some)
    values.update(
        produce_witness=lambda: Marker() if fault == 'wrong-produced' else Witness(),
        produce_token=lambda: Token(None),
        witnesses=lambda count: tuple(Witness() for _ in range(
            natural(count) - (1 if fault == 'array-length' and count else 0))),
        maybe_witness=lambda present: (
            (Witness() if fault == 'option-collapsed' else Some(Witness())) if boolean(present) else None),
        produce_marker=lambda: Marker(),
        produce_mark=lambda active: MarkMarked(Witness()) if boolean(active) else MarkBlank())
    if not result_only or fault == 'inputs-exported':
        values.update(
            witness_count=lambda value: 1 if witness_input(value) is None or True else 1,
            absent_count=refused,
            token_tag=lambda value: unit(exact(value, Token).tag),
            marker_count=lambda value: 0 if exact(value, Marker) else 0,
            mark_count=mark_count)
    if fault == 'missing-producer':
        del values['produce_mark']
    return SimpleNamespace(**values)


results = []
for route, result_only, prefix in (
    ('ordinary-source', False, 'arg'), ('reviewed-ir', False, 'value'),
    ('result-only-ordinary-source', True, 'arg'), ('result-only-reviewed-ir', True, 'value')):
    results.append(dict(route=route, **caller.check_zero_payload_records(api(result_only, prefix), result_only, prefix)))

rejected = {}
for mode, result_only, faults in (
    ('full', False, ('accept-invalid', 'wrong-status', 'wrong-message', 'wrong-produced',
                     'missing-producer', 'option-collapsed', 'array-length', 'host-accepts-none')),
    ('result-only', True, ('wrong-produced', 'missing-producer', 'inputs-exported',
                           'option-collapsed', 'array-length'))):
    rejected[mode] = []
    for fault in faults:
        try:
            caller.check_zero_payload_records(api(result_only, 'arg', fault), result_only, 'arg')
        except AssertionError:
            rejected[mode].append(fault)
        else:
            raise AssertionError('Caller accepted fault: ' + fault)
print(json.dumps(dict(results=results, rejectedFaults=rejected), sort_keys=True))
