"""Supplemental Python primitive-base caller: strict-constructor and variant-refusal cases only.

The original python.py caller and its counts are unchanged. Executions require an installed package.
"""
import dataclasses
import json
import math
import struct
import sys


FIELDS = (
    'unit_value', 'bool_value', 'uint8_value', 'uint16_value', 'uint32_value',
    'uint64_value', 'int8_value', 'int16_value', 'int32_value', 'int64_value',
    'nat_value', 'int_value', 'float32_value', 'float64_value', 'text_value',
    'bytes_value', 'char_value', 'usize_value', 'isize_value', 'digit')
# Each value satisfies its Subtype predicate but not the stricter input constructor A.
STRICT_VALUES = (
    ('uint8_value', 100, 'uint8A'), ('uint16_value', 100, 'uint16A'),
    ('uint32_value', 100, 'uint32A'), ('uint64_value', 100, 'uint64A'),
    ('int8_value', 100, 'int8A'), ('int16_value', 100, 'int16A'),
    ('int32_value', 100, 'int32A'), ('int64_value', 100, 'int64A'),
    ('nat_value', 100, 'natA'), ('int_value', 100, 'intA'),
    ('float32_value', 12.5, 'float32A'), ('float64_value', 12.5, 'float64A'),
    ('text_value', 'long λ text', 'textA'), ('bytes_value', bytes(range(8)), 'bytesA'),
    ('char_value', 'λ', 'charA'), ('usize_value', 100, 'usizeA'),
    ('isize_value', 100, 'isizeA'))


def check_nominal_primitive_supplement(api, parameter_prefix='arg'):
    if parameter_prefix not in ('arg', 'value'):
        raise ValueError('Invalid parameter prefix')
    checks = rejections = 0
    Packet, RawPacket = api.Packet, api.RawPacket
    Some, Ok, Err = api.Some, api.Ok, api.Err
    Box, Choices = api.EventBox, api.EventChoices
    diagnostic_field = lambda field: field[:-6] + 'Value'
    fields = {Packet: FIELDS, RawPacket: FIELDS, Some: ('value',), Ok: ('value',),
              Err: ('value',), Box: ('value',), Choices: ('values',)}

    def snapshot(value):
        kind = type(value)
        if value is None or kind in (bool, int, str, bytes):
            return (kind.__name__, value)
        if kind is float:
            return ('float', 'nan' if math.isnan(value) else struct.pack('>d', value))
        if kind in (list, tuple):
            return (kind.__name__, tuple(snapshot(item) for item in value))
        if kind not in fields:
            raise AssertionError('Unexpected public value type: ' + repr(kind))
        names = fields[kind]
        if tuple(field.name for field in dataclasses.fields(value)) != names:
            raise AssertionError('Unexpected record fields: ' + kind.__name__)
        return (kind.__name__, tuple((name, snapshot(getattr(value, name))) for name in names))

    def check(condition, label):
        nonlocal checks
        if not condition:
            raise AssertionError('failed: ' + label)
        checks += 1

    def call(name, args, expected):
        before = snapshot(args)
        result = getattr(api, name)(*args)
        check(snapshot(result) == snapshot(expected), name + ' exact result')
        check(snapshot(args) == before, name + ' inputs unchanged')

    def refuse(name, args, path, constructor):
        nonlocal rejections
        before = snapshot(args)
        expected = path + ' was rejected by NominalPrimitiveSubtypes.' + constructor
        try:
            getattr(api, name)(*args)
        except api.LeanBridgeError as error:
            check(error.status == 1 and str(error) == expected, 'exact refusal: ' + expected)
        else:
            raise AssertionError('Accepted invalid input: ' + expected)
        check(snapshot(args) == before, name + ' refused inputs unchanged')
        rejections += 1

    def packet(kind=Packet, **changes):
        values = dict(unit_value=None, bool_value=True, uint8_value=42, uint16_value=42,
                      uint32_value=42, uint64_value=42, int8_value=-42, int16_value=-42,
                      int32_value=-42, int64_value=-42, nat_value=42, int_value=-42,
                      float32_value=1.5, float64_value=1.5, text_value='a',
                      bytes_value=bytes((0, 128, 255)), char_value='a',
                      usize_value=42, isize_value=-42, digit=2)
        values.update(changes)
        return kind(**values)

    def normalized(**changes):
        values = dict(uint8_value=44, uint16_value=44, uint32_value=44, uint64_value=44,
                      int8_value=-40, int16_value=-40, int32_value=-40, int64_value=-40,
                      nat_value=44, int_value=-40, float32_value=-1.5, float64_value=-1.5,
                      text_value='a!', bytes_value=bytes((0, 128, 255, 255)),
                      char_value='b', usize_value=44, isize_value=-40)
        values.update(changes)
        return packet(**values)

    a, b, n = packet(), packet(bool_value=False), normalized()
    for field, value, constructor in STRICT_VALUES:
        # The weaker output predicate admits the raw value; constructor A refuses the same input.
        call('produce', (packet(RawPacket, **{field: value}),), Some(packet(**{field: value})))
        refuse('echo_a', (packet(**{field: value}),),
               parameter_prefix + '0.' + diagnostic_field(field), constructor)
        call('echo_a', (a,), a)
    for second, name in enumerate(('echo_event_a', 'echo_event_b')):
        first_input, last_input = (a, b) if second == 0 else (b, a)
        first_output, last_output = (a, n) if second == 0 else (n, a)
        invalid = lambda selected: packet(bool_value=selected.bool_value, nat_value=43)
        refuse(name, (Box(invalid(first_input)),), parameter_prefix + '0.box.value.natValue',
               'natA' if second == 0 else 'natB')
        call(name, (Box(first_input),), Box(first_output))
        for branch in range(2):
            items = [None, Some(Ok(first_input)), Some(Err(last_input))]
            selected = first_input if branch == 0 else last_input
            items[branch + 1] = Some((Ok if branch == 0 else Err)(invalid(selected)))
            refuse(name, (Choices(tuple(items)),),
                   f"{parameter_prefix}0.choices.values[{branch + 1}]?.{'ok' if branch == 0 else 'error'}.natValue",
                   'natA' if second == branch else 'natB')
            call(name, (Choices((None, Some(Ok(first_input)), Some(Err(last_input)))),),
                 Choices((None, Some(Ok(first_output)), Some(Err(last_output)))))
    return dict(checks=checks, rejections=rejections, strictValues=len(STRICT_VALUES),
                variantRefusals=6)


if __name__ == '__main__':
    import lean_nominalprimitivesubtypes as installed
    print(json.dumps(check_nominal_primitive_supplement(
        installed, parameter_prefix='value' if '--reviewed' in sys.argv else 'arg'), sort_keys=True))
