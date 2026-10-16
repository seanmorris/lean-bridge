"""Exercise a standalone nested caller oracle only; no Lean or installed library executes."""
import dataclasses
import importlib.util
import json
import sys
import types
from types import SimpleNamespace


if len(sys.argv) not in (2, 3):
    raise ValueError('Expected caller path and optional generated value-class module')
spec = importlib.util.spec_from_file_location('nested_caller', sys.argv[1])
caller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(caller)


class LeanBridgeError(RuntimeError):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


classes = {name: dataclasses.make_dataclass(name, [(field, object) for field in fields], frozen=True)
           for name, fields in [('Packet', ('digit', 'word')), ('Holder', ('packet', 'tag')),
                                ('ChoiceEmpty', ()), ('ChoicePacket', ('value',)),
                                ('Some', ('value',)), ('Ok', ('value',)), ('Err', ('value',))]}
classes['LeanBridgeError'] = LeanBridgeError
if len(sys.argv) > 2:
    module = types.ModuleType('generated_nested_values')
    sys.modules[module.__name__] = module
    with open(sys.argv[2], encoding='utf-8') as stream:
        generated_source = stream.read()
    assert generated_source.count('from . import _native\n') == 1
    exec(compile(generated_source.replace('from . import _native\n', ''), sys.argv[2], 'exec'), module.__dict__)
    classes = {name: getattr(module, name) for name in classes}
Packet, Holder = classes['Packet'], classes['Holder']
ChoiceEmpty, ChoicePacket = classes['ChoiceEmpty'], classes['ChoicePacket']
Some, Ok, Err, Error = classes['Some'], classes['Ok'], classes['Err'], classes['LeanBridgeError']
MK, NORMALIZE = 'mk', 'normalize'
RESULT_FAULTS = ('produce-offset', 'produce-array-length', 'produce-list-result',
                 'produce-bare-packet', 'accept-bool', 'wrong-host-exception')
RESULT_ONLY_FAULTS = ('inputs-exported',)
INPUT_FAULTS = ('missing-fin', 'fin-after-constructor', 'missing-normalization',
                'conflated-constructor', 'diagnostic-suffix', 'wrong-status', 'wrong-path',
                'wrong-choice', 'except-swapped', 'holder-tag', 'echo-normalizes',
                'echo-list-result', 'echo-swapped-fields', 'mutate-accepted-input',
                'mutate-rejected-input', 'list-as-array')


def oracle(result_only=False, prefix='arg', fault=None):
    def host(kind, message):
        raise (Error(1, message) if fault == 'wrong-host-exception' else kind(message))

    def natural(value):
        if type(value) is not int and not (fault == 'accept-bool' and type(value) is bool):
            host(TypeError, 'Expected an int, without Boolean or numeric coercion')
        if value < 0:
            host(ValueError, 'Integer is outside the declared Lean range')
        return int(value)

    def packet(value):
        if type(value) is not Packet:
            host(TypeError, 'Expected Packet')
        natural(value.digit)
        natural(value.word)
        return value

    def sequence(value):
        if type(value) not in (tuple, list):
            host(TypeError, 'Expected a tuple or list')
        for item in value:
            packet(item)
        return value

    def suffix():
        return '.' if fault == 'diagnostic-suffix' else ''

    def reject(message):
        raise Error(2 if fault == 'wrong-status' else 1, message + suffix())

    def accept(value, path, site):
        # Fin 10 digit, then the word constructor, then the packet constructor.
        packet_choice, word_choice = site
        digit, word = value.digit, value.word
        if fault not in ('missing-fin', 'fin-after-constructor') and digit >= 10:
            reject(path + '.digit is not below its Fin 10 bound')
        if fault == 'missing-normalization':
            word_choice = MK
        if word_choice == MK and word == 0:
            reject(path + '.word was rejected by NestedCheckedRecords.mkWord')
        if word_choice == NORMALIZE:
            word += 1
        if fault == 'fin-after-constructor' and digit >= 10:
            reject(path + '.digit is not below its Fin 10 bound')
        if fault == 'conflated-constructor':
            packet_choice = MK
        if packet_choice == MK and digit > word:
            reject(path + ' was rejected by NestedCheckedRecords.mkPacket')
        return digit + 1 if packet_choice == NORMALIZE else word

    def element_path(index):
        return prefix + (f'0.{index}' if fault == 'wrong-path' else f'0[{index}]')

    def total(values, site):
        return sum(accept(item, element_path(index), site) for index, item in enumerate(values))

    def mutate(value):
        if type(value) is list and value:
            value[0] = Packet(9, 9)

    def produced(value, offset):
        return Packet(0, natural(value) + offset + (1 if fault == 'produce-offset' else 0))

    def produce_option(value):
        item = produced(value, 1)
        return item if fault == 'produce-bare-packet' else Some(item)

    def produce_array(value):
        items = [produced(value, 1), produced(value, 2)][:1 if fault == 'produce-array-length' else 2]
        return items if fault == 'produce-list-result' else tuple(items)

    def in_array(values):
        sequence(values)
        try:
            result = total(values, (MK, MK))
        except Error:
            if fault == 'mutate-rejected-input':
                mutate(values)
            raise
        if fault == 'mutate-accepted-input':
            mutate(values)
        return result

    def in_option(value):
        if value is not None and type(value) is not Some:
            host(TypeError, 'Option requires None or Some(value)')
        return 0 if value is None else accept(packet(value.value), prefix + '0?', (MK, NORMALIZE))

    def in_product(value):
        if type(value) is not tuple:
            host(TypeError, 'Prod requires a two-element tuple')
        if len(value) != 2:
            host(ValueError, 'Prod requires exactly two elements')
        left, right = packet(value[0]), packet(value[1])
        return accept(left, prefix + '0.0', (MK, MK)) + accept(right, prefix + '0.1', (NORMALIZE, NORMALIZE))

    def in_except(value):
        if type(value) not in (Ok, Err):
            host(TypeError, 'Result requires Ok(value) or Err(value)')
        ok = (type(value) is Ok) != (fault == 'except-swapped')
        return accept(packet(value.value), prefix + ('0.ok' if ok else '0.error'),
                      (NORMALIZE, MK) if ok else (MK, NORMALIZE))

    def in_holder(value):
        if type(value) is not Holder:
            host(TypeError, 'Expected Holder')
        tag = natural(value.tag)
        word = accept(packet(value.packet), prefix + '0.packet', (NORMALIZE, MK))
        return word + (0 if fault == 'holder-tag' else tag)

    def in_choice(value):
        if type(value) is ChoiceEmpty:
            return 1 if fault == 'wrong-choice' else 0
        if type(value) is not ChoicePacket:
            host(TypeError, 'Expected a named Choice constructor')
        return accept(packet(value.value), prefix + '0.packet.value', (MK, NORMALIZE))

    def echo_array(values):
        sequence(values)
        total(values, (MK, MK))
        items = [Packet(item.word, item.digit) if fault == 'echo-swapped-fields' else item for item in values]
        if fault == 'echo-normalizes' and items:
            items[0] = Packet(items[0].digit, 1)
        return items if fault == 'echo-list-result' else tuple(items)

    def pair(left, right):
        packet(left)
        packet(right)
        return accept(left, prefix + '0', (MK, MK)) + accept(right, prefix + '1', (NORMALIZE, NORMALIZE))

    functions = dict(produce_option=produce_option, produce_array=produce_array)
    if not result_only or fault == 'inputs-exported':
        list_site = (MK, MK) if fault == 'list-as-array' else (NORMALIZE, NORMALIZE)
        functions.update(
            first=lambda value: accept(packet(value), prefix + '0', (MK, MK)),
            second=lambda value: accept(packet(value), prefix + '0', (NORMALIZE, NORMALIZE)),
            pair=pair, in_array=in_array,
            in_list=lambda values: total(sequence(values), list_site),
            in_option=in_option, in_product=in_product, in_except=in_except,
            in_holder=in_holder, in_choice=in_choice, echo_array=echo_array)
    surface = {name: classes[name] for name in ('Packet', 'Some', 'LeanBridgeError')}
    if not result_only:
        surface.update({name: classes[name] for name in ('Holder', 'ChoiceEmpty', 'ChoicePacket', 'Ok', 'Err')})
    return SimpleNamespace(**surface, **functions)


results = []
for result_only in (False, True):
    for prefix in ('arg', 'value'):
        result = caller.check_nested_checked_records(oracle(result_only, prefix), result_only,
                                                     parameter_prefix=prefix)
        results.append(dict(resultOnly=result_only, parameterPrefix=prefix, **result))
rejected = {}
for mode, result_only, faults in (('full', False, RESULT_FAULTS + INPUT_FAULTS),
                                  ('result-only', True, RESULT_FAULTS + RESULT_ONLY_FAULTS)):
    rejected[mode] = []
    for fault in faults:
        try:
            caller.check_nested_checked_records(oracle(result_only, fault=fault), result_only, rounds=2)
        except AssertionError:
            rejected[mode].append(fault)
        else:
            raise AssertionError(f'Caller accepted {mode} fault: {fault}')
print(json.dumps(dict(results=results, rejectedFaults=rejected, generatedValueClasses=len(sys.argv) > 2,
                      installedAcceptance=False), sort_keys=True))
