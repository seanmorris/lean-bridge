from . import LeanBridgeError, Some, Packet
from . import _assets as _GraphAssets

import ctypes as _c
import builtins as _b

if _c.sizeof(_c.c_void_p) != 8:
    raise ImportError("Native copied graphs require 64-bit pointers")

class _GraphInvalidNative(LeanBridgeError):
    def __init__(self, message="Invalid native copied value"):
        super().__init__(4, message)

class _GraphLimit(ValueError):
    pass

def _graph_checkpoint():
    pass

class _GraphScope:
    def __init__(self, check_only=False):
        self.check_only = check_only
        self.nodes = 262144
        self.native = 16 * 1024 * 1024
        self.storage = 16 * 1024 * 1024
        self.active = set()
        self.owners = []

    def charge(self, field, count, width=1):
        remaining = getattr(self, field)
        if count < 0 or width < 1 or count > remaining // width:
            raise _GraphLimit("16 MiB copied graph conversion limit exceeded")
        setattr(self, field, remaining - count * width)

    def enter(self, key, depth, raw, native_storage, output=False):
        if depth > 128 or self.nodes == 0:
            raise _GraphLimit("Copied graph depth or node limit exceeded")
        self.nodes -= 1
        if native_storage:
            self.charge("native", 1, _c.sizeof(raw))
        if key is not None:
            if key in self.active:
                if output:
                    raise _GraphInvalidNative("Cyclic native copied value")
                raise ValueError("Cyclic Python copied value")
            self.active.add(key)

    def leave(self, key):
        if key is not None:
            self.active.remove(key)

    def value(self, raw, value=None):
        self.charge("storage", 1, _c.sizeof(raw) + 256)
        if self.check_only:
            return None
        _graph_checkpoint()
        result = raw() if value is None else raw(value)
        self.owners.append(result)
        return result

    def allocate(self, raw, count):
        self.charge("storage", count, _c.sizeof(raw))
        self.charge("storage", 256)
        if self.check_only:
            return None
        _graph_checkpoint()
        result = (raw * count)()
        self.owners.append(result)
        return result

    def close(self):
        self.owners.clear()
        self.active.clear()

def _graph_integer(value, minimum, maximum):
    if type(value) is not int:
        raise TypeError("Expected an int without Boolean or numeric coercion")
    if minimum is not None and value < minimum or maximum is not None and value > maximum:
        raise ValueError("Integer is outside the declared Lean range")
    return value

def _graph_text_size(value, limit):
    if len(value) > limit:
        raise _GraphLimit("Copied graph UTF-8 limit exceeded")
    if value.isascii():
        return len(value)
    size = 0
    for character in value:
        code = ord(character)
        if 0xd800 <= code <= 0xdfff:
            raise ValueError("String requires Unicode scalar values")
        size += 1 if code < 0x80 else 2 if code < 0x800 else 3 if code < 0x10000 else 4
        if size > limit:
            raise _GraphLimit("Copied graph UTF-8 limit exceeded")
    return size

def _graph_span(pointer, count, raw):
    if not count:
        return 0
    width = _c.sizeof(raw)
    if (not pointer or pointer % _c.alignment(raw)
            or count > ((1 << 63) - 1) // width
            or pointer > (1 << 64) - 1 - count * width):
        raise _GraphInvalidNative("Missing, misaligned or overflowing native span")
    # The authenticated adapter supplies readable process memory. Address checks
    # do not make arbitrary foreign pointers safe to dereference.
    return pointer

def _graph_read(pointer, raw):
    return raw.from_address(_graph_span(pointer, 1, raw))

def _graph_status(status):
    if status == 0:
        return
    if status not in (1, 2, 3, 5):
        raise _GraphInvalidNative()
    raise LeanBridgeError(status, {1: "Invalid native input", 2: "Native copied graph limit exceeded", 3: "Native allocation failed", 5: "Lean runtime is unavailable"}[status])

_GraphRelease = _c.CFUNCTYPE(None, _c.c_void_p)

def _graph_clear(value):
    if value is None or not _b.hasattr(value, "owner"):
        return
    owner, release = value.owner, value.release
    _c.memset(_c.addressof(value), 0, _c.sizeof(value))
    if owner and release:
        _GraphRelease(release)(owner)


def _graph_checked_status(status, diagnostic):
    if status != 1:
        return _graph_status(status)
    message = diagnostic()
    if message is None:
        return _graph_status(status)
    try:
        text = message.decode("utf-8")
    except UnicodeDecodeError:
        raise _GraphInvalidNative("Malformed native refinement diagnostic") from None
    raise LeanBridgeError(status, text)

class _GraphValues:
    Some = Some
    Packet = Packet

class _Raw0(_c.Structure):
    pass

class _Raw1(_c.Structure):
    pass

class _Raw2(_c.Structure):
    pass

class _Raw3(_c.Structure):
    pass

_Raw0._fields_ = [("owner", _c.c_void_p), ("release", _c.c_void_p), ("data", _c.c_void_p), ("length", _c.c_size_t)]

_Raw1._fields_ = [("owner", _c.c_void_p), ("release", _c.c_void_p), ("has_value", _c.c_uint8), ("field0", _c.c_void_p)]

_Raw3._fields_ = [("owner", _c.c_void_p), ("release", _c.c_void_p), ("data", _c.c_void_p), ("length", _c.c_size_t)]

_Raw2._fields_ = [("owner", _c.c_void_p), ("release", _c.c_void_p), ("field0", _Raw3), ("field1", _Raw3), ("field2", _c.c_void_p)]

def _graph_input0(value, scope, depth=0, native_storage=True):
    key = _b.id(value)
    scope.enter(key, depth, _Raw0, native_storage)
    try:
        if type(value) not in (list, tuple): raise TypeError("Expected a list or tuple")
        length = len(value)
        if length > scope.nodes: raise _GraphLimit("Copied graph node limit exceeded")
        scope.charge("native", length, _c.sizeof(_Raw1))
        out = scope.value(_Raw0)
        buffer = scope.allocate(_Raw1, length)
        for index in range(length):
            child = _graph_input1(value[index], scope, depth + 1, False)
            if not scope.check_only: buffer[index] = child
        if len(value) != length: raise ValueError("Do not mutate copied input during conversion")
        if not scope.check_only:
            out.data = _c.addressof(buffer) if length else None
            out.length = length
        return out
    finally:
        scope.leave(key)

def _graph_output0(value, scope, depth=0, native_storage=True):
    key = (0, _c.addressof(value))
    scope.enter(key, depth, _Raw0, native_storage, True)
    try:
        if value.length > scope.nodes: raise _GraphLimit("Copied graph node limit exceeded")
        scope.charge("native", value.length, _c.sizeof(_Raw1))
        scope.charge("storage", value.length, 16)
        scope.charge("storage", 128)
        pointer = _graph_span(value.data, value.length, _Raw1)
        memory = (_Raw1 * value.length).from_address(pointer) if value.length else ()
        _graph_checkpoint()
        result = []
        for child in memory:
            result.append(_graph_output1(child, scope, depth + 1, False))
        _graph_checkpoint()
        return tuple(result)
    finally:
        scope.leave(key)

def _graph_input1(value, scope, depth=0, native_storage=True):
    key = _b.id(value)
    scope.enter(key, depth, _Raw1, native_storage)
    try:
        if value is None: return scope.value(_Raw1)
        if type(value) is _GraphValues.Some:
            out = scope.value(_Raw1)
            if not scope.check_only: out.has_value = 1
            child = _graph_input2(value.value, scope, depth + 1, True)
            if not scope.check_only:
                out.field0 = _c.addressof(child)
            return out
        raise TypeError("Expected None or Some(value)")
    finally:
        scope.leave(key)

def _graph_output1(value, scope, depth=0, native_storage=True):
    key = (1, _c.addressof(value))
    scope.enter(key, depth, _Raw1, native_storage, True)
    try:
        if value.has_value == 0: return None
        if value.has_value == 1:
            scope.charge("storage", 272)
            _graph_checkpoint()
            return _GraphValues.Some(_graph_output2(_graph_read(value.field0, _Raw2), scope, depth + 1, True))
        raise _GraphInvalidNative("Invalid native option flag")
    finally:
        scope.leave(key)

def _graph_input2(value, scope, depth=0, native_storage=True):
    key = _b.id(value)
    scope.enter(key, depth, _Raw2, native_storage)
    try:
        if type(value) is not _GraphValues.Packet: raise TypeError("Expected Packet")
        out = scope.value(_Raw2)
        child = _graph_input3(value.value, scope, depth + 1, False)
        if not scope.check_only:
            out.field0 = child
        child = _graph_input3(value.digit, scope, depth + 1, False)
        if not scope.check_only:
            out.field1 = child
        child = _graph_input1(value.tail, scope, depth + 1, True)
        if not scope.check_only:
            out.field2 = _c.addressof(child)
        return out
    finally:
        scope.leave(key)

def _graph_output2(value, scope, depth=0, native_storage=True):
    key = (2, _c.addressof(value))
    scope.enter(key, depth, _Raw2, native_storage, True)
    try:
        scope.charge("storage", 304)
        _graph_checkpoint()
        return _GraphValues.Packet(_graph_output3(value.field0, scope, depth + 1, False), _graph_output3(value.field1, scope, depth + 1, False), _graph_output1(_graph_read(value.field2, _Raw1), scope, depth + 1, True))
    finally:
        scope.leave(key)

def _graph_input3(value, scope, depth=0, native_storage=True):
    key = None
    scope.enter(key, depth, _Raw3, native_storage)
    try:
        _graph_integer(value, 0, None)
        length = (value.bit_length() + 31) // 32
        scope.charge("native", length, 4)
        scope.charge("storage", length, 8)
        out = scope.value(_Raw3)
        buffer = scope.allocate(_c.c_uint32, length)
        if not scope.check_only:
            data = abs(value).to_bytes(length * 4, "little")
            if length: _c.memmove(buffer, data, length * 4)
            out.data = _c.addressof(buffer) if length else None
            out.length = length
        return out
    finally:
        scope.leave(key)

def _graph_output3(value, scope, depth=0, native_storage=True):
    key = None
    scope.enter(key, depth, _Raw3, native_storage, True)
    try:
        scope.charge("native", value.length, 4)
        scope.charge("storage", value.length, 8)
        pointer = _graph_span(value.data, value.length, _c.c_uint32)
        _graph_checkpoint()
        data = _c.string_at(pointer, value.length * 4) if value.length else b""
        magnitude = int.from_bytes(data, "little")
        return magnitude
    finally:
        scope.leave(key)

def _graph_call_echo(invoke, arg0, *, lifecycle=None):
    checked = _GraphScope(True)
    try:
        _graph_input2(arg0, checked)
    finally:
        checked.close()
    scope = _GraphScope()
    output = None
    try:
        input0 = _graph_input2(arg0, scope)
        output = scope.value(_Raw2)
        if lifecycle is not None: _graph_status(lifecycle[0]())
        _graph_checked_status(invoke(_c.byref(input0), _c.byref(output)), _graph_diagnostic)
        result = _graph_output2(output, scope)
        if lifecycle is not None and not lifecycle[1](): raise LeanBridgeError(5, "Lean runtime is unavailable")
        return result
    except _GraphInvalidNative:
        if lifecycle is not None: lifecycle[2]()
        raise
    finally:
        try:
            _graph_clear(output)
        finally:
            scope.close()

def _graph_call_echo_groups(invoke, arg0, *, lifecycle=None):
    checked = _GraphScope(True)
    try:
        _graph_input0(arg0, checked)
    finally:
        checked.close()
    scope = _GraphScope()
    output = None
    try:
        input0 = _graph_input0(arg0, scope)
        output = scope.value(_Raw0)
        if lifecycle is not None: _graph_status(lifecycle[0]())
        _graph_checked_status(invoke(_c.byref(input0), _c.byref(output)), _graph_diagnostic)
        result = _graph_output0(output, scope)
        if lifecycle is not None and not lifecycle[1](): raise LeanBridgeError(5, "Lean runtime is unavailable")
        return result
    except _GraphInvalidNative:
        if lifecycle is not None: lifecycle[2]()
        raise
    finally:
        try:
            _graph_clear(output)
        finally:
            scope.close()

def _graph_call_first(invoke, arg0, *, lifecycle=None):
    checked = _GraphScope(True)
    try:
        _graph_input2(arg0, checked)
    finally:
        checked.close()
    scope = _GraphScope()
    output = None
    try:
        input0 = _graph_input2(arg0, scope)
        output = scope.value(_Raw3)
        if lifecycle is not None: _graph_status(lifecycle[0]())
        _graph_checked_status(invoke(_c.byref(input0), _c.byref(output)), _graph_diagnostic)
        result = _graph_output3(output, scope)
        if lifecycle is not None and not lifecycle[1](): raise LeanBridgeError(5, "Lean runtime is unavailable")
        return result
    except _GraphInvalidNative:
        if lifecycle is not None: lifecycle[2]()
        raise
    finally:
        try:
            _graph_clear(output)
        finally:
            scope.close()

def _graph_call_groups(invoke, arg0, *, lifecycle=None):
    checked = _GraphScope(True)
    try:
        _graph_input0(arg0, checked)
    finally:
        checked.close()
    scope = _GraphScope()
    output = None
    try:
        input0 = _graph_input0(arg0, scope)
        output = scope.value(_Raw3)
        if lifecycle is not None: _graph_status(lifecycle[0]())
        _graph_checked_status(invoke(_c.byref(input0), _c.byref(output)), _graph_diagnostic)
        result = _graph_output3(output, scope)
        if lifecycle is not None and not lifecycle[1](): raise LeanBridgeError(5, "Lean runtime is unavailable")
        return result
    except _GraphInvalidNative:
        if lifecycle is not None: lifecycle[2]()
        raise
    finally:
        try:
            _graph_clear(output)
        finally:
            scope.close()

def _graph_call_produce(invoke, arg0, *, lifecycle=None):
    checked = _GraphScope(True)
    try:
        _graph_input3(arg0, checked)
    finally:
        checked.close()
    scope = _GraphScope()
    output = None
    try:
        input0 = _graph_input3(arg0, scope)
        output = scope.value(_Raw2)
        if lifecycle is not None: _graph_status(lifecycle[0]())
        _graph_checked_status(invoke(_c.byref(input0), _c.byref(output)), _graph_diagnostic)
        result = _graph_output2(output, scope)
        if lifecycle is not None and not lifecycle[1](): raise LeanBridgeError(5, "Lean runtime is unavailable")
        return result
    except _GraphInvalidNative:
        if lifecycle is not None: lifecycle[2]()
        raise
    finally:
        try:
            _graph_clear(output)
        finally:
            scope.close()

def _graph_call_second(invoke, arg0, *, lifecycle=None):
    checked = _GraphScope(True)
    try:
        _graph_input2(arg0, checked)
    finally:
        checked.close()
    scope = _GraphScope()
    output = None
    try:
        input0 = _graph_input2(arg0, scope)
        output = scope.value(_Raw3)
        if lifecycle is not None: _graph_status(lifecycle[0]())
        _graph_checked_status(invoke(_c.byref(input0), _c.byref(output)), _graph_diagnostic)
        result = _graph_output3(output, scope)
        if lifecycle is not None and not lifecycle[1](): raise LeanBridgeError(5, "Lean runtime is unavailable")
        return result
    except _GraphInvalidNative:
        if lifecycle is not None: lifecycle[2]()
        raise
    finally:
        try:
            _graph_clear(output)
        finally:
            scope.close()


_graph_initialize = _GraphAssets._LIBRARY["recursivecheckedrecords_graph_initialize"]
_graph_initialize.argtypes = []
_graph_initialize.restype = _c.c_uint32
_graph_ready = _GraphAssets._LIBRARY["recursivecheckedrecords_graph_ready"]
_graph_ready.argtypes = []
_graph_ready.restype = _c.c_int
_graph_retire = _GraphAssets._LIBRARY["recursivecheckedrecords_graph_retire"]
_graph_retire.argtypes = []
_graph_retire.restype = None
_graph_lifecycle = (_graph_initialize, _graph_ready, _graph_retire)
_graph_diagnostic = _GraphAssets._LIBRARY["recursivecheckedrecords_graph_error"]
_graph_diagnostic.argtypes = []
_graph_diagnostic.restype = _c.c_char_p

_fn0 = _GraphAssets._LIBRARY["recursivecheckedrecords_echo_graph"]
_fn0.argtypes = [_c.POINTER(_Raw2), _c.POINTER(_Raw2)]
_fn0.restype = _c.c_uint32

def _call0(arg0):
    _GraphAssets._ensure_process()
    return _graph_call_echo(_fn0, arg0, lifecycle=_graph_lifecycle)

_fn1 = _GraphAssets._LIBRARY["recursivecheckedrecords_echo_groups_graph"]
_fn1.argtypes = [_c.POINTER(_Raw0), _c.POINTER(_Raw0)]
_fn1.restype = _c.c_uint32

def _call1(arg0):
    _GraphAssets._ensure_process()
    return _graph_call_echo_groups(_fn1, arg0, lifecycle=_graph_lifecycle)

_fn2 = _GraphAssets._LIBRARY["recursivecheckedrecords_first_graph"]
_fn2.argtypes = [_c.POINTER(_Raw2), _c.POINTER(_Raw3)]
_fn2.restype = _c.c_uint32

def _call2(arg0):
    _GraphAssets._ensure_process()
    return _graph_call_first(_fn2, arg0, lifecycle=_graph_lifecycle)

_fn3 = _GraphAssets._LIBRARY["recursivecheckedrecords_groups_graph"]
_fn3.argtypes = [_c.POINTER(_Raw0), _c.POINTER(_Raw3)]
_fn3.restype = _c.c_uint32

def _call3(arg0):
    _GraphAssets._ensure_process()
    return _graph_call_groups(_fn3, arg0, lifecycle=_graph_lifecycle)

_fn4 = _GraphAssets._LIBRARY["recursivecheckedrecords_produce_graph"]
_fn4.argtypes = [_c.POINTER(_Raw3), _c.POINTER(_Raw2)]
_fn4.restype = _c.c_uint32

def _call4(arg0):
    _GraphAssets._ensure_process()
    return _graph_call_produce(_fn4, arg0, lifecycle=_graph_lifecycle)

_fn5 = _GraphAssets._LIBRARY["recursivecheckedrecords_second_graph"]
_fn5.argtypes = [_c.POINTER(_Raw2), _c.POINTER(_Raw3)]
_fn5.restype = _c.c_uint32

def _call5(arg0):
    _GraphAssets._ensure_process()
    return _graph_call_second(_fn5, arg0, lifecycle=_graph_lifecycle)
