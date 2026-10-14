"""Independent native Python primitive-base caller; executions require an installed package."""
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
INPUTS = ('echo_a', 'echo_b', 'refuse_unit', 'combine', 'echo_pair',
          'echo_event_a', 'echo_event_b', 'aliases')


def check_nominal_primitive_subtypes(api, result_only=False, rounds=256,
                                    parameter_prefix='arg'):
    if type(result_only) is not bool or type(rounds) is not int or not 1 <= rounds <= 1000:
        raise ValueError('Invalid primitive caller options')
    if parameter_prefix not in ('arg', 'value'):
        raise ValueError('Invalid parameter prefix')
    checks = rejections = snapshot_controls = 0
    Packet, RawPacket, Pair = api.Packet, api.RawPacket, api.Pair
    Some, Ok, Err = api.Some, api.Ok, api.Err
    Empty, Box, Choices = api.EventEmpty, api.EventBox, api.EventChoices
    diagnostic_field = lambda field: field[:-6] + 'Value' if field.endswith('_value') else field
    fields = {Packet: FIELDS, RawPacket: FIELDS, Pair: ('left', 'right'),
              Some: ('value',), Ok: ('value',), Err: ('value',),
              Empty: (), Box: ('value',), Choices: ('values',)}

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
        return result

    def refuse(name, args, path, constructor=None, bound=None):
        nonlocal rejections
        before = snapshot(args)
        expected = (path + ' is not below its Fin ' + str(bound) + ' bound'
                    if bound is not None else path + ' was rejected by NominalPrimitiveSubtypes.' + constructor)
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

    def produced(kind=Packet, **changes):
        values = dict(uint8_value=200, uint16_value=200, uint32_value=200, uint64_value=200,
                      int8_value=120, int16_value=120, int32_value=120, int64_value=120,
                      nat_value=2**100, int_value=-(2**100), float32_value=12.5,
                      float64_value=12.5, text_value='long λ text',
                      bytes_value=bytes((0, 1, 2, 3, 4, 5, 128, 254, 255)),
                      char_value='λ', usize_value=200, isize_value=200)
        values.update(changes)
        return packet(kind, **values)

    for name in INPUTS:
        check(hasattr(api, name) != result_only, 'input export selection: ' + name)
    a, b, n, out, raw_out = packet(), packet(bool_value=False), normalized(), produced(), produced(RawPacket)
    for left, right in ((None, False), (False, 0), (0, 0.0), (0.0, -0.0),
                        (b'\x00', b'\x01'), ('a\0λ😀', 'aλ😀'),
                        ((None, Some(out)), (Some(out), None)),
                        (Box(out), Choices((Some(Ok(out)),))),
                        (packet(), packet(RawPacket))):
        check(snapshot(left) != snapshot(right), 'independent snapshot mutation')
        snapshot_controls += 1
    call('word_bits', (), 64)
    group = (None, Some(out))
    call('produce', (raw_out,), Some(out))
    call('produce_group', (raw_out,), group)
    call('produce_pair', (raw_out,), Pair(group, group))
    call('produce_event', (raw_out,), Box(out))
    call('produce_choices', (raw_out,), Choices((None, Some(Ok(out)), Some(Err(out)))))
    invalid = dict(bool_value=False, uint8_value=43, uint16_value=43, uint32_value=43,
                   uint64_value=43, int8_value=-43, int16_value=-43, int32_value=-43,
                   int64_value=-43, nat_value=43, int_value=-43,
                   float32_value=float('inf'), float64_value=float('inf'),
                   text_value='', bytes_value=b'', char_value='\0',
                   usize_value=43, isize_value=-43, digit=3)
    constructors = dict(bool_value='boolA', uint8_value='uint8A', uint16_value='uint16A',
                        uint32_value='uint32A', uint64_value='uint64A', int8_value='int8A',
                        int16_value='int16A', int32_value='int32A', int64_value='int64A',
                        nat_value='natA', int_value='intA', float32_value='float32A',
                        float64_value='float64A', text_value='textA', bytes_value='bytesA',
                        char_value='charA', usize_value='usizeA', isize_value='isizeA')
    for field, value in invalid.items():
        call('produce', (packet(RawPacket, **{field: value}),), None)
        if not result_only:
            refuse('echo_a', (packet(**{field: value}),), parameter_prefix + '0.' + diagnostic_field(field),
                   constructor=constructors.get(field), bound=3 if field == 'digit' else None)
    absent = packet(RawPacket, nat_value=43)
    call('produce_group', (absent,), (None,))
    call('produce_pair', (absent,), Pair((None,), (None,)))
    call('produce_event', (absent,), Empty())
    call('produce_choices', (absent,), Choices((None,)))
    if result_only:
        for round_ in range(rounds):
            value = 2**100 + round_ * 2
            call('produce', (produced(RawPacket, nat_value=value),), Some(produced(nat_value=value)))
        return dict(checks=checks, rejections=rejections, snapshotControls=snapshot_controls,
                    rounds=rounds, wordBits=64)
    call('echo_a', (a,), a)
    call('echo_b', (b,), n)
    refuse('refuse_unit', (a,), parameter_prefix + '0.unitValue', 'unitReject')
    call('combine', (a, b), (a, n))
    call('echo_pair', (Pair([None, Some(a)], [Some(b)]),), Pair((None, Some(a)), (Some(n),)))
    call('aliases', ([None, Some(a)], [Some(b), None]), (None, Some(a), Some(n), None))
    for name in ('echo_event_a', 'echo_event_b'):
        call(name, (Empty(),), Empty())
    call('echo_event_a', (Box(a),), Box(a))
    call('echo_event_b', (Box(b),), Box(n))
    call('echo_event_a', (Choices((None, Some(Ok(a)), Some(Err(b)))),),
         Choices((None, Some(Ok(a)), Some(Err(n)))))
    call('echo_event_b', (Choices((None, Some(Ok(b)), Some(Err(a)))),),
         Choices((None, Some(Ok(n)), Some(Err(a)))))
    cases = (
        ('uint8_value', 254, 0), ('uint16_value', 65534, 0),
        ('uint32_value', 2**32 - 2, 0), ('uint64_value', 2**64 - 2, 0),
        ('int8_value', 126, -128), ('int16_value', 32766, -32768),
        ('int32_value', 2**31 - 2, -(2**31)), ('int64_value', 2**63 - 2, -(2**63)),
        ('usize_value', 2**64 - 2, 0), ('isize_value', 2**63 - 2, -(2**63)),
        ('nat_value', 2**100, 2**100 + 2), ('int_value', -(2**100), -(2**100) + 2),
        ('float32_value', 0.0, -0.0), ('float64_value', 0.0, -0.0),
        ('float32_value', -0.0, 0.0), ('float64_value', -0.0, 0.0),
        ('text_value', 'a\0λ😀', 'a\0λ😀!'), ('bytes_value', b'', b'\xff'),
        ('char_value', '😀', '😀'))
    for field, value, expected in cases:
        call('echo_b', (packet(bool_value=False, **{field: value}),), normalized(**{field: expected}))
    for field, constructor in (('float32_value', 'float32B'), ('float64_value', 'float64B')):
        for value in (float('nan'), float('inf'), -float('inf')):
            refuse('echo_b', (packet(bool_value=False, **{field: value}),),
                   parameter_prefix + '0.' + diagnostic_field(field), constructor)
            call('produce', (packet(RawPacket, **{field: value}),), None)
    refuse('combine', (packet(nat_value=43), packet(bool_value=False, digit=3)),
           parameter_prefix + '1.digit', bound=3)
    for round_ in range(rounds):
        items = [Some(b), None, Some(b)]
        items[round_ % 3] = Some(packet(bool_value=False, nat_value=43))
        refuse('echo_pair', (Pair([Some(a)], items),),
               parameter_prefix + f'0.right[{round_ % 3}]?.natValue', 'natB')
        call('echo_b', (b,), n)
    return dict(checks=checks, rejections=rejections, snapshotControls=snapshot_controls,
                rounds=rounds, wordBits=64)


if __name__ == '__main__':
    import lean_nominalprimitivesubtypes as installed
    print(json.dumps(check_nominal_primitive_subtypes(installed, '--result-only' in sys.argv,
                                                     parameter_prefix='value' if '--reviewed' in sys.argv else 'arg'),
                     sort_keys=True))
