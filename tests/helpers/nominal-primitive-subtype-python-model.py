"""Exercise a standalone caller oracle only; no Lean or installed library executes."""
import copy
import dataclasses
import importlib.util
import json
import math
import sys
import types
from types import SimpleNamespace


if len(sys.argv) not in (2, 3):
    raise ValueError('Expected caller path and optional generated value-class module')
spec = importlib.util.spec_from_file_location('primitive_caller', sys.argv[1])
caller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(caller)
names = ('unit_value', 'bool_value', 'uint8_value', 'uint16_value', 'uint32_value', 'uint64_value',
         'int8_value', 'int16_value', 'int32_value', 'int64_value', 'nat_value', 'int_value',
         'float32_value', 'float64_value', 'text_value', 'bytes_value', 'char_value',
         'usize_value', 'isize_value', 'digit')
classes = {name: dataclasses.make_dataclass(name, [(field, object) for field in fields], frozen=True)
           for name, fields in [('Packet', names), ('RawPacket', names), ('Pair', ('left', 'right')),
                                ('Some', ('value',)), ('Ok', ('value',)), ('Err', ('value',)),
                                ('EventEmpty', ()), ('EventBox', ('value',)), ('EventChoices', ('values',))]}
if len(sys.argv) > 2:
    module = types.ModuleType('generated_primitive_values')
    sys.modules[module.__name__] = module
    with open(sys.argv[2], encoding='utf-8') as stream:
        generated_source = stream.read()
    assert generated_source.count('from . import _native\n') == 1
    exec(compile(generated_source.replace('from . import _native\n', ''), sys.argv[2], 'exec'), module.__dict__)
    classes = {name: getattr(module, name) for name in classes}
Packet = classes['Packet']
RawPacket = classes['RawPacket']
Some, Ok, Err = classes['Some'], classes['Ok'], classes['Err']
Pair, Empty, Box, Choices = classes['Pair'], classes['EventEmpty'], classes['EventBox'], classes['EventChoices']
numeric = names[2:12] + names[17:19]


class LeanBridgeError(Exception):
    def __init__(self, text):
        self.status = 1
        super().__init__(text)


def oracle(result_only=False, prefix='arg'):
    def valid(value):
        return (value.bool_value is True and all(getattr(value, field) % 2 == 0 for field in numeric)
                and math.isfinite(value.float32_value) and math.isfinite(value.float64_value)
                and len(value.text_value) > 0 and len(value.bytes_value) > 0
                and value.char_value != '\0' and value.digit < 3)

    def fin(value, path):
        if type(value) is Packet and value.digit >= 3:
            raise LeanBridgeError(path + '.digit is not below its Fin 3 bound')
        if type(value) in (list, tuple):
            for index, item in enumerate(value):
                fin(item, path + f'[{index}]')
        elif type(value) in (Packet, Pair, Some, Ok, Err, Box, Choices):
            for field in dataclasses.fields(value):
                tail = ('?' if type(value) is Some else '.ok' if type(value) is Ok
                        else '.error' if type(value) is Err else '.' + field.name)
                fin(getattr(value, field.name), path + tail)

    def convert(value, choice, path):
        values = {field: getattr(value, field) for field in names}
        if choice == 'B':
            values['bool_value'] = not values['bool_value']
            for field in numeric:
                number = values[field] + 2
                if field not in ('nat_value', 'int_value'):
                    bits = (64 if field in ('usize_value', 'isize_value') else
                            int(''.join(char for char in field if char.isdigit())))
                    signed = field.startswith('int') or field == 'isize_value'
                    number %= 2**bits
                    if signed and number >= 2**(bits - 1):
                        number -= 2**bits
                values[field] = number
            for field in ('float32_value', 'float64_value'):
                values[field] = -values[field]
            values['text_value'] += '!'
            values['bytes_value'] += b'\xff'
            if values['char_value'] == 'a':
                values['char_value'] = 'b'
        for field in names[:-1]:
            item = values[field]
            okay = (True if field == 'unit_value' else item is True if field == 'bool_value'
                    else item % 2 == 0 if field in numeric
                    else math.isfinite(item) if field.startswith('float')
                    else len(item) > 0 if field in ('text_value', 'bytes_value')
                    else item != '\0')
            if choice == 'A':
                okay = okay and (item < 100 if field in numeric
                                 else item < 10 if field.startswith('float')
                                 else len(item) < 8 if field in ('text_value', 'bytes_value')
                                 else ord(item) < 128 if field == 'char_value' else True)
            if not okay:
                constructor = field[:-len('_value')] + choice
                raise LeanBridgeError(path + '.' + (field[:-6] + 'Value' if field.endswith('_value') else field) + ' was rejected by NominalPrimitiveSubtypes.' + constructor)
        return Packet(**values)

    def checked(fn):
        def invoke(*args):
            for index, value in enumerate(args):
                fin(value, prefix + str(index))
            return fn(*args)
        return invoke

    def group(values, choice, path):
        return tuple(None if item is None else Some(convert(item.value, choice, path + f'[{index}]?'))
                     for index, item in enumerate(values))

    def event(value, first, second):
        if type(value) is Empty:
            return Empty()
        if type(value) is Box:
            return Box(convert(value.value, first, prefix + '0.box.value'))
        return Choices(tuple(None if item is None else
                             Some(Ok(convert(item.value.value, first, prefix + f'0.choices.values[{index}]?.ok')))
                             if type(item.value) is Ok else
                             Some(Err(convert(item.value.value, second, prefix + f'0.choices.values[{index}]?.error')))
                             for index, item in enumerate(value.values)))

    def produced(value):
        return Packet(**{field: getattr(value, field) for field in names})

    def produced_group(value):
        return (None, Some(produced(value))) if valid(value) else (None,)

    def refuse_unit(value):
        raise LeanBridgeError(prefix + '0.unitValue was rejected by NominalPrimitiveSubtypes.unitReject')

    functions = dict(word_bits=lambda: 64,
                     produce=lambda value: Some(produced(value)) if valid(value) else None,
                     produce_group=produced_group,
                     produce_pair=lambda value: Pair(produced_group(value), produced_group(value)),
                     produce_event=lambda value: Box(produced(value)) if valid(value) else Empty(),
                     produce_choices=lambda value: Choices((None, Some(Ok(produced(value))), Some(Err(produced(value))))
                                                           if valid(value) else (None,)))
    if not result_only:
        functions.update(echo_a=checked(lambda value: convert(value, 'A', prefix + '0')),
                         echo_b=checked(lambda value: convert(value, 'B', prefix + '0')),
                         refuse_unit=checked(refuse_unit),
                         combine=checked(lambda a, b: (convert(a, 'A', prefix + '0'), convert(b, 'B', prefix + '1'))),
                         echo_pair=checked(lambda value: Pair(group(value.left, 'A', prefix + '0.left'),
                                                              group(value.right, 'B', prefix + '0.right'))),
                         aliases=checked(lambda a, b: group(a, 'A', prefix + '0') + group(b, 'B', prefix + '1')),
                         echo_event_a=checked(lambda value: event(value, 'A', 'B')),
                         echo_event_b=checked(lambda value: event(value, 'B', 'A')))
    return SimpleNamespace(**classes, LeanBridgeError=LeanBridgeError, **functions)


results = []
for result_only in (False, True):
    for prefix in ('arg', 'value'):
        api = oracle(result_only, prefix)
        result = caller.check_nominal_primitive_subtypes(api, result_only, parameter_prefix=prefix)
        results.append(dict(resultOnly=result_only, parameterPrefix=prefix, **result))
mutations = []
for field in names:
    api = oracle()
    original = api.echo_a

    def changed(value, field=field, original=original):
        result = original(value)
        items = {name: getattr(result, name) for name in names}
        items[field] = 'wrong'
        return Packet(**items)

    api.echo_a = changed
    try:
        caller.check_nominal_primitive_subtypes(api, rounds=1)
    except AssertionError as error:
        assert 'echo_a exact result' in str(error), str(error)
        mutations.append(field)
    else:
        raise AssertionError('Caller accepted field mutation: ' + field)
for name, mutate in (
    ('wrong-word-width', lambda api: setattr(api, 'word_bits', lambda: 32)),
    ('normalization-bypass', lambda api: setattr(api, 'echo_b', copy.deepcopy)),
    ('unit-refusal-bypass', lambda api: setattr(api, 'refuse_unit', copy.deepcopy)),
    ('inactive-branch-added', lambda api: setattr(api, 'produce_event', lambda value: Empty())),
):
    api = oracle()
    mutate(api)
    try:
        caller.check_nominal_primitive_subtypes(api, rounds=1)
    except AssertionError:
        mutations.append(name)
    else:
        raise AssertionError('Caller accepted semantic mutation: ' + name)
print(json.dumps(dict(results=results, rejectedMutations=mutations, generatedValueClasses=len(sys.argv) > 2, installedAcceptance=False), sort_keys=True))
