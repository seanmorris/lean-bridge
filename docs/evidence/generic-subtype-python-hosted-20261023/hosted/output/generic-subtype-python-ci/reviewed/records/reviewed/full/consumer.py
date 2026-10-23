"""Independent installed Python checks for closed generic Subtype compositions."""
import dataclasses
import json

import lean_nominalsubtypes as api


def snapshot(value):
    if type(value) is int:
        return ('int', value)
    if type(value) is not api.GenericNat:
        raise AssertionError('unexpected value: ' + repr(type(value)))
    if tuple(field.name for field in dataclasses.fields(value)) != ('value', 'marker'):
        raise AssertionError('unexpected GenericNat fields')
    return ('GenericNat', value.value, value.marker)


checks = rejections = 0


def check(condition, label):
    global checks
    if not condition:
        raise AssertionError('failed: ' + label)
    checks += 1


def call(name, value, expected):
    before = snapshot(value)
    result = getattr(api, name)(value)
    check(snapshot(result) == snapshot(expected), name + ' exact copied result')
    check(snapshot(value) == before, name + ' input unchanged')


def scalar(value, expected):
    before = snapshot(value)
    result = api.generic_use(value)
    check(result == expected, 'generic_use exact result')
    check(snapshot(value) == before, 'generic_use input unchanged')


def refused(name, value, constructor):
    global rejections
    before = snapshot(value)
    message = 'value0.value was rejected by NominalSubtypes.' + constructor
    try:
        getattr(api, name)(value)
    except api.LeanBridgeError as error:
        check(error.status == 1 and str(error) == message, name + ' exact refusal')
    else:
        raise AssertionError('accepted: ' + message)
    check(snapshot(value) == before, name + ' rejected input unchanged')
    rejections += 1


scalar(api.GenericNat(40, 2), 43)
call('echo_generic_first', api.GenericNat(40, 2), api.GenericNat(41, 2))
call('echo_generic_second', api.GenericNat(40, 2), api.GenericNat(42, 2))
scalar(api.GenericNat(99, 7), 107)
call('echo_generic_first', api.GenericNat(99, 7), api.GenericNat(100, 7))
refused('generic_use', api.GenericNat(100, 2), 'plusOne')
refused('echo_generic_first', api.GenericNat(100, 2), 'plusOne')
refused('echo_generic_second', api.GenericNat(90, 2), 'plusTwo')
call('echo_generic_second', api.GenericNat(40, 2), api.GenericNat(42, 2))
print(json.dumps({'checks': checks, 'rejections': rejections}, sort_keys=True))
