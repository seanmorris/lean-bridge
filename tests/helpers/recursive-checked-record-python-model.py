"""Exercise a standalone recursive caller oracle only; no Lean or installed library executes."""
import dataclasses
import importlib.util
import json
import sys
import types
from types import SimpleNamespace


if len(sys.argv) not in (2, 4):
    raise ValueError('Expected caller path and optional generated recursive and mutual modules')
spec = importlib.util.spec_from_file_location('recursive_caller', sys.argv[1])
caller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(caller)


class LeanBridgeError(RuntimeError):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


LIMIT = 'Copied graph depth or node limit exceeded'
MODULES = {
    'recursive': dict(lean='RecursiveCheckedRecords', record='Packet', fields=('value', 'digit', 'tail'),
                      make='mkPacket', normalize='normalizePacket'),
    'mutual': dict(lean='MutualCheckedRecords', record='Envelope', fields=('value', 'mode', 'next'),
                   make='mkEnvelope', normalize='normalizeEnvelope'),
}
RESULT_FAULTS = ('produce-offset', 'produce-single', 'produce-digits', 'accept-bool',
                 'wrong-host-exception', 'alias-copy')
INPUT_FAULTS = ('missing-fin', 'missing-normalization', 'conflated-constructor', 'diagnostic-suffix',
                'wrong-status', 'wrong-path', 'root-only', 'echo-unnormalized', 'echo-drops-tail',
                'mutate-accepted-input', 'mutate-rejected-input', 'cycle-as-lean', 'depth-unbounded',
                'shared-as-cycle', 'groups-drop-none', 'echo-groups-drops-none', 'poison-after-reject')
MODULE_FAULTS = {'recursive': ('second-normalizes-root-only',), 'mutual': ('stop-as-none',)}


def surface(module, generated=None):
    names = MODULES[module]['fields']
    if generated is not None:
        record = MODULES[module]['record']
        classes = {name: getattr(generated, name) for name in ('Some', record, record + 'Alias')}
        if module == 'mutual':
            classes.update(StepStop=generated.StepStop, StepMore=generated.StepMore)
        return classes
    Some = dataclasses.make_dataclass('Some', [('value', object)], frozen=True)
    Record = dataclasses.make_dataclass(MODULES[module]['record'], [(name, object) for name in names],
                                        frozen=True, slots=True)
    classes = {'Some': Some, Record.__name__: Record, Record.__name__ + 'Alias': Record}
    if module == 'mutual':
        classes['StepStop'] = dataclasses.make_dataclass('StepStop', [], frozen=True, slots=True)
        classes['StepMore'] = dataclasses.make_dataclass('StepMore', [('packet', object)], frozen=True,
                                                         slots=True)
    return classes


def oracle(module, classes, fault=None):
    spec_ = MODULES[module]
    Some, Record = classes['Some'], classes[spec_['record']]
    Stop, More = classes.get('StepStop'), classes.get('StepMore')
    value_name, bound_name, link_name = spec_['fields']
    poisoned = []

    def host(kind, message):
        raise (LeanBridgeError(1, message) if fault == 'wrong-host-exception' else kind(message))

    def lean_reject(message):
        if fault == 'diagnostic-suffix':
            message += '.'
        poisoned.append(True)
        raise LeanBridgeError(2 if fault == 'wrong-status' else 1, message)

    # Python conversion: exact classes, integer domains, active-path cycles and depth.
    def convert(value, kind, depth, active):
        if depth > 128 and fault != 'depth-unbounded':
            host(ValueError, LIMIT)
        if kind == 'nat':
            if type(value) is not int and not (fault == 'accept-bool' and type(value) is bool):
                host(TypeError, 'Expected an int without Boolean or numeric coercion')
            if value < 0:
                host(ValueError, 'Integer is outside the declared Lean range')
            return
        key = id(value)
        if key in active or (fault == 'shared-as-cycle' and key in seen):
            if fault == 'cycle-as-lean':
                raise LeanBridgeError(1, 'Invalid copied value')
            host(ValueError, 'Cyclic Python copied value')
        seen.add(key)
        active = active | {key}
        if kind == 'groups':
            if type(value) not in (list, tuple):
                host(TypeError, 'Expected a list or tuple')
            for item in value:
                convert(item, 'option-record', depth + 1, active)
        elif kind in ('option-record', 'option-step'):
            if value is None:
                return
            if type(value) is not Some:
                host(TypeError, 'Expected None or Some(value)')
            convert(value.value, kind[7:], depth + 1, active)
        elif kind == 'step':
            if type(value) is Stop:
                return
            if type(value) is not More:
                host(TypeError, 'Expected StepStop or StepMore')
            convert(value.packet, 'record', depth + 1, active)
        else:
            if type(value) is not Record:
                host(TypeError, 'Expected ' + Record.__name__)
            convert(getattr(value, value_name), 'nat', depth + 1, active)
            convert(getattr(value, bound_name), 'nat', depth + 1, active)
            convert(getattr(value, link_name), 'option-step' if module == 'mutual' else 'option-record',
                    depth + 1, active)

    def child(record):
        link = getattr(record, link_name)
        if link is None:
            return None, None
        if module == 'recursive':
            return link.value, '.tail?'
        if type(link.value) is Stop:
            return None, None
        return link.value.packet, '.next?.more.packet'

    # Adapter refinements: every Fin bound first, then children before each outer constructor.
    def fin(record, path):
        if getattr(record, bound_name) >= 3 and fault != 'missing-fin':
            lean_reject(path + '.' + bound_name + ' is not below its Fin 3 bound')
        nested, link = child(record)
        if nested is not None and fault != 'root-only':
            fin(nested, path + ('' if fault == 'wrong-path' else link))

    def construct(record, path, site):
        plus, limit, word_name, outer = ((1, 99, 'plusOne', spec_['make'])
                                         if site == 'make' or fault == 'conflated-constructor'
                                         else (2, 89, 'plusTwo', spec_['normalize']))
        value = getattr(record, value_name)
        if value > limit:
            lean_reject(path + '.value was rejected by ' + spec_['lean'] + '.' + word_name)
        nested, link = child(record)
        tail = None
        if nested is not None and fault != 'root-only':
            tail = construct(nested, path + ('' if fault == 'wrong-path' else link), site)
        elif nested is not None:
            tail = nested
        normalized = value + (0 if fault == 'missing-normalization' else plus)
        digit = getattr(record, bound_name)
        if outer.startswith('mk') and digit > normalized:
            lean_reject(path + ' was rejected by ' + spec_['lean'] + '.' + outer)
        if outer == 'normalizePacket':
            normalized = digit + 1
        if outer == 'normalizePacket' and fault == 'second-normalizes-root-only' and path != 'arg0':
            normalized = value
        return rebuild(record, normalized, tail)

    def rebuild(record, value, tail):
        link = getattr(record, link_name)
        if module == 'recursive':
            next_ = None if tail is None or fault == 'echo-drops-tail' else Some(tail)
        elif link is None or type(link.value) is Stop:
            next_ = None if link is None or fault == 'stop-as-none' else Some(Stop())
        else:
            next_ = None if fault == 'echo-drops-tail' else Some(More(tail))
        return Record(value, getattr(record, bound_name), next_)

    def accepted(name, args, kind, site, use):
        nonlocal seen
        if poisoned and fault == 'poison-after-reject':
            raise LeanBridgeError(1, 'poisoned')
        seen = set()
        convert(args, kind, 0, frozenset())
        if kind == 'groups':
            for index, item in enumerate(args):
                if item is not None:
                    fin(item.value, 'arg0[' + str(index) + ']?')
            values = tuple(None if item is None else Some(construct(item.value, 'arg0[' + str(index) + ']?', site))
                           for index, item in enumerate(args))
        else:
            fin(args, 'arg0')
            values = construct(args, 'arg0', site)
        if fault == 'mutate-accepted-input' and kind == 'record':
            object.__setattr__(args, bound_name, getattr(args, bound_name))
            object.__setattr__(args, value_name, getattr(args, value_name) + 1)
        return use(values)

    def guarded(function):
        def call(*args):
            try:
                return function(*args)
            except LeanBridgeError:
                if fault == 'mutate-rejected-input' and args and type(args[0]) is Record:
                    object.__setattr__(args[0], value_name, getattr(args[0], value_name) + 1)
                raise
        return call

    def produce(value):
        nonlocal seen
        seen = set()
        convert(value, 'nat', 0, frozenset())
        offset = 0 if fault == 'produce-offset' else 1
        digits = (2, 1) if fault == 'produce-digits' else (1, 2)
        tail = None if fault == 'produce-single' else Record(value + offset + 1, digits[1], None)
        if tail is None:
            return Record(value + offset, digits[0], None)
        return Record(value + offset, digits[0], Some(tail) if module == 'recursive' else Some(More(tail)))

    def echoed(record):
        return record if fault != 'echo-unnormalized' else None

    seen = set()
    functions = dict(
        first=guarded(lambda value: accepted('first', value, 'record', 'make', lambda record: getattr(record, value_name))),
        second=guarded(lambda value: accepted('second', value, 'record', 'normalize', lambda record: getattr(record, value_name))),
        echo=guarded(lambda value: echoed(accepted('echo', value, 'record', 'make', lambda record: record)) or value),
        groups=guarded(lambda values: accepted('groups', values, 'groups', 'make', lambda items: len(
            [item for item in items if item is not None or fault != 'groups-drop-none']))),
        echo_groups=guarded(lambda values: accepted('echo_groups', values, 'groups', 'normalize', lambda items: tuple(
            item for item in items if item is not None or fault != 'echo-groups-drops-none'))),
        produce=guarded(produce))
    exposed = dict(classes)
    if fault == 'alias-copy':
        exposed[Record.__name__ + 'Alias'] = type(Record.__name__, (), {})
    return SimpleNamespace(**exposed, LeanBridgeError=LeanBridgeError, **functions)


def generated_module(path, name):
    module = types.ModuleType(name)
    sys.modules[name] = module
    with open(path, encoding='utf-8') as stream:
        source = stream.read()
    marker = 'from . import _native as _GraphNative\n'
    assert source.count(marker) == 1
    exec(compile(source.replace(marker, ''), path, 'exec'), module.__dict__)
    return module


generated = {}
if len(sys.argv) == 4:
    generated = {'recursive': generated_module(sys.argv[2], 'generated_recursive'),
                 'mutual': generated_module(sys.argv[3], 'generated_mutual')}
results, rejected = [], {}
for module in ('recursive', 'mutual'):
    classes = surface(module, generated.get(module))
    results.append(caller.check_recursive_checked_records(oracle(module, classes), module))
    rejected[module] = []
    for fault in RESULT_FAULTS + INPUT_FAULTS + MODULE_FAULTS[module]:
        try:
            caller.check_recursive_checked_records(oracle(module, surface(module, generated.get(module)), fault),
                                                   module, rounds=2)
        except AssertionError:
            rejected[module].append(fault)
        else:
            raise AssertionError(f'Caller accepted {module} fault: {fault}')
print(json.dumps(dict(results=results, rejectedFaults=rejected, generatedValueClasses=bool(generated),
                      installedAcceptance=False), sort_keys=True))
