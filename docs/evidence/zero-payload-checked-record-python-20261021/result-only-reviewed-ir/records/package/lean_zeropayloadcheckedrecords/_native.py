import ctypes as _c
from . import LeanBridgeError, Some, Witness, Mark, MarkBlank, MarkMarked, Marker, Token

import hashlib as _hashlib
import os as _os
import pathlib as _pathlib
import platform as _platform
import stat as _stat
import sys as _sys
import threading as _threading
import types as _types

if (_sys.version_info < (3, 11) or _sys.platform != "linux"
        or _platform.machine() not in ("x86_64", "AMD64")
        or _c.sizeof(_c.c_void_p) != 8 or _sys.byteorder != "little"):
    raise ImportError("This Lean package requires Python 3.11+ on Linux x86-64")
if hasattr(_sys, "_is_gil_enabled") and not _sys._is_gil_enabled():
    raise ImportError("This Lean package requires a GIL-enabled interpreter")

_PID = _os.getpid()
_root = _pathlib.Path(__file__).resolve().parent / "native" / "linux-x64"
_libraries = {"libzeropayloadcheckedrecords.so":"18a2c6795f89bfbf3228fda0fd0b49ea4ecd938d608812e8665d9c63aa2bdcd1","libcomponent_d43d7c5a9f170f3ce127.so":"5a457d3be3c5d97ca78f9df38fa8517cde29f729d11cd058043d02c1ff1f26c6","liblean_bridge_native.so":"459fcd2098d4b646ab6ae0f4cdccd1f222908cb162562bfc3940a533cd4e4e21","libleanshared.so":"d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4"}
for _name, _expected in _libraries.items():
    _path = _root / _name
    if not _stat.S_ISREG(_path.lstat().st_mode):
        raise ImportError("Native library is not a regular file: " + _name)
    with _path.open("rb") as _stream:
        _actual = _hashlib.file_digest(_stream, "sha256").hexdigest()
    if _actual != _expected:
        raise ImportError("Native library differs from compiled evidence: " + _name)

# No shared on-disk module: uninstalling one wheel must not break another.
_candidate = _types.ModuleType("_lean_bridge_copied_runtime_v1")
_candidate.lock = _threading.RLock()
_candidate.pid = _PID
_candidate.identity = None
_candidate.failed = False
_candidate.components = {}
_candidate.libraries = {}
_candidate.handles = []
_state = _sys.modules.setdefault(_candidate.__name__, _candidate)
if _state.pid != _PID:
    raise ImportError("Start a fresh Python interpreter after fork to use Lean packages")
with _state.lock:
    if _state.failed:
        raise ImportError("Lean native loading failed earlier in this interpreter")
    if _state.identity not in (None, "4b5a7fdf0cb11d4bb429181cfd50b330c5622ed8f5f5382a293955a439b595b5"):
        raise ImportError("Incompatible Lean runtime identities")
    for _name, _expected in _libraries.items():
        if _state.libraries.get(_name, _expected) != _expected:
            raise ImportError("Conflicting builds of the same native library: " + _name)
    _previous = _state.components.get("zeropayloadcheckedrecords@1.0.0")
    if _previous is not None and _previous[0] != "c04633530b1ac5fd7dcca6e4e5e89ce01d36685621daa68bcad303e56d09439a":
        raise ImportError("Conflicting builds of the same Lean component")
    try:
        if _previous is None:
            for _name in ["libleanshared.so","liblean_bridge_native.so","libcomponent_d43d7c5a9f170f3ce127.so","libzeropayloadcheckedrecords.so"]:
                if _name not in _state.libraries:
                    _loaded = _c.CDLL(str(_root / _name), mode=_os.RTLD_NOW | _os.RTLD_GLOBAL)
                    _state.handles.append(_loaded)
                    _state.libraries[_name] = _libraries[_name]
                else:
                    _loaded = next(item for item in _state.handles if _pathlib.Path(item._name).name == _name)
            _previous = ("c04633530b1ac5fd7dcca6e4e5e89ce01d36685621daa68bcad303e56d09439a", _loaded)
            _state.components["zeropayloadcheckedrecords@1.0.0"] = _previous
            _state.identity = "4b5a7fdf0cb11d4bb429181cfd50b330c5622ed8f5f5382a293955a439b595b5"
        _LIBRARY = _previous[1]
    except BaseException:
        _state.failed = True
        raise

def _ensure_process():
    if _os.getpid() != _PID:
        raise RuntimeError("Start a fresh Python interpreter after fork to use Lean packages")

class _T1(_c.Structure):
    _fields_ = [("empty", _c.c_uint8)]

class _T2(_c.Structure):
    _fields_ = [("has_value", _c.c_uint8), ("value", _T1)]

class _V3_0(_c.Structure):
    _fields_ = [("empty", _c.c_uint8)]

class _V3_1(_c.Structure):
    _fields_ = [("witness", _T1)]

class _V3(_c.Union):
    _fields_ = [("case0", _V3_0), ("case1", _V3_1)]

class _T3(_c.Structure):
    _fields_ = [("kind", _c.c_uint32), ("cases", _V3)]

class _T4(_c.Structure):
    _fields_ = [("empty", _c.c_uint8)]

class _T6(_c.Structure):
    _fields_ = [("tag", _c.c_uint8)]

class _T7(_c.Structure):
    _fields_ = [("data", _c.c_void_p), ("length", _c.c_size_t), ("owner", _c.c_void_p), ("release", _c.c_void_p)]

class _T8(_c.Structure):
    _fields_ = [("data", _c.c_void_p), ("length", _c.c_size_t), ("owner", _c.c_void_p), ("release", _c.c_void_p)]

class _Scope:
    def __init__(self):
        self.remaining = 16 * 1024 * 1024
        self.owners = []
        self.failure = None

    def charge(self, count, width=1):
        if count < 0 or width < 1 or count > self.remaining // width:
            raise ValueError("16 MiB Python conversion limit exceeded")
        self.remaining -= count * width

    def allocate(self, element, count):
        self.charge(count, _c.sizeof(element))
        value = (element * count)()
        self.owners.append(value)
        return value

    def close(self):
        self.owners.clear()
        self.failure = None

def _integer(value, minimum, maximum):
    if type(value) is not int:
        raise TypeError("Expected an int, without Boolean or numeric coercion")
    if (minimum is not None and value < minimum) or (maximum is not None and value > maximum):
        raise ValueError("Integer is outside the declared Lean range")
    return value

def _text_size(value):
    if value.isascii():
        return len(value)
    return sum(1 if ord(c) < 0x80 else 2 if ord(c) < 0x800 else 3 if ord(c) < 0x10000 else 4 for c in value)

def _buffer(data, scope):
    memory = scope.allocate(_c.c_uint8, len(data))
    if data:
        _c.memmove(memory, data, len(data))
    return _c.addressof(memory) if data else None

def _read(data, length, scope, width=1):
    scope.charge(length, width)
    if length and not data:
        raise LeanBridgeError(5, "Native result has a missing buffer")
    return _c.string_at(data, length) if length else b""

class _Error(_c.Structure):
    _fields_ = [("code", _c.c_int), ("message", _c.c_void_p), ("message_length", _c.c_size_t)]

def _check(status, error, scope=None):
    if scope is not None and scope.failure is not None:
        raise scope.failure
    if status:
        message = _c.string_at(error.message, min(error.message_length, 16384)).decode("utf-8", "replace") if error.message else "Native Lean call failed"
        raise LeanBridgeError(status, message)


_clear1 = _LIBRARY["zeropayloadcheckedrecords_witness_clear"]
_clear1.argtypes = [_c.POINTER(_T1)]
_clear1.restype = None
_clear2 = _LIBRARY["zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value_clear"]
_clear2.argtypes = [_c.POINTER(_T2)]
_clear2.restype = None
_clear3 = _LIBRARY["zeropayloadcheckedrecords_mark_clear"]
_clear3.argtypes = [_c.POINTER(_T3)]
_clear3.restype = None
_clear4 = _LIBRARY["zeropayloadcheckedrecords_marker_clear"]
_clear4.argtypes = [_c.POINTER(_T4)]
_clear4.restype = None
_clear6 = _LIBRARY["zeropayloadcheckedrecords_token_clear"]
_clear6.argtypes = [_c.POINTER(_T6)]
_clear6.restype = None
_clear7 = _LIBRARY["zeropayloadcheckedrecords_nat_clear"]
_clear7.argtypes = [_c.POINTER(_T7)]
_clear7.restype = None
_clear8 = _LIBRARY["zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span_clear"]
_clear8.argtypes = [_c.POINTER(_T8)]
_clear8.restype = None
_fn0 = _LIBRARY["zeropayloadcheckedrecords_maybe_witness"]
_fn0.argtypes = [_c.c_bool, _c.POINTER(_T2), _c.POINTER(_Error)]
_fn0.restype = _c.c_int
_fn1 = _LIBRARY["zeropayloadcheckedrecords_produce_mark"]
_fn1.argtypes = [_c.c_bool, _c.POINTER(_T3), _c.POINTER(_Error)]
_fn1.restype = _c.c_int
_fn2 = _LIBRARY["zeropayloadcheckedrecords_produce_marker"]
_fn2.argtypes = [_c.POINTER(_T4), _c.POINTER(_Error)]
_fn2.restype = _c.c_int
_fn3 = _LIBRARY["zeropayloadcheckedrecords_produce_token"]
_fn3.argtypes = [_c.POINTER(_T6), _c.POINTER(_Error)]
_fn3.restype = _c.c_int
_fn4 = _LIBRARY["zeropayloadcheckedrecords_produce_witness"]
_fn4.argtypes = [_c.POINTER(_T1), _c.POINTER(_Error)]
_fn4.restype = _c.c_int
_fn5 = _LIBRARY["zeropayloadcheckedrecords_witnesses"]
_fn5.argtypes = [_c.POINTER(_T7), _c.POINTER(_T8), _c.POINTER(_Error)]
_fn5.restype = _c.c_int

def _to0(value, scope):
    scope.charge(1, _c.sizeof(_c.c_bool))
    if type(value) is not bool: raise TypeError("Bool requires bool")
    return value

def _from0(value, scope):
    scope.charge(1, _c.sizeof(_c.c_bool))
    return bool(value)

def _to1(value, scope):
    scope.charge(1, _c.sizeof(_T1))
    if type(value) is not Witness: raise TypeError("Expected Witness")
    return _T1()

def _from1(value, scope):
    scope.charge(1, _c.sizeof(_T1))
    return Witness()

def _to2(value, scope):
    scope.charge(1, _c.sizeof(_T2))
    if value is None: return _T2()
    if type(value) is not Some: raise TypeError("Option requires None or Some(value)")
    return _T2(1, _to1(value.value, scope))

def _from2(value, scope):
    scope.charge(1, _c.sizeof(_T2))
    if value.has_value > 1: raise LeanBridgeError(5, "Invalid native option flag")
    return Some(_from1(value.value, scope)) if value.has_value else None

def _to3(value, scope):
    scope.charge(1, _c.sizeof(_T3))
    if type(value) is MarkBlank:
        return _T3(kind=0, cases=_V3(case0=_V3_0()))
    if type(value) is MarkMarked:
        return _T3(kind=1, cases=_V3(case1=_V3_1(witness=_to1(value.witness, scope))))
    raise TypeError("Expected a named Mark constructor")

def _from3(value, scope):
    scope.charge(1, _c.sizeof(_T3))
    if value.kind == 0:
        return MarkBlank()
    if value.kind == 1:
        return MarkMarked(witness=_from1(value.cases.case1.witness, scope))
    raise LeanBridgeError(5, "Invalid native Mark constructor")

def _to4(value, scope):
    scope.charge(1, _c.sizeof(_T4))
    if type(value) is not Marker: raise TypeError("Expected Marker")
    return _T4()

def _from4(value, scope):
    scope.charge(1, _c.sizeof(_T4))
    return Marker()

def _to5(value, scope):
    scope.charge(1, _c.sizeof(_c.c_uint8))
    if value is not None: raise TypeError("Unit requires None")
    return 0

def _from5(value, scope):
    scope.charge(1, _c.sizeof(_c.c_uint8))
    return None

def _to6(value, scope):
    scope.charge(1, _c.sizeof(_T6))
    if type(value) is not Token: raise TypeError("Expected Token")
    return _T6(_to5(value.tag, scope))

def _from6(value, scope):
    scope.charge(1, _c.sizeof(_T6))
    return Token(tag=_from5(value.tag, scope))

def _to7(value, scope):
    scope.charge(1, _c.sizeof(_T7))
    _integer(value, 0, None)
    length = (value.bit_length() + 31) // 32
    scope.charge(length, 4)
    data = abs(value).to_bytes(length * 4, "little")
    return _T7(_buffer(data, scope), length, None, None)

def _from7(value, scope):
    scope.charge(1, _c.sizeof(_T7))
    magnitude = int.from_bytes(_read(value.data, value.length * 4, scope, 2), "little")
    return magnitude

def _to8(value, scope):
    scope.charge(1, _c.sizeof(_T8))
    if type(value) not in (tuple, list): raise TypeError("Expected a tuple or list")
    scope.charge(len(value), 8)
    value = tuple(value)
    memory = scope.allocate(_T1, len(value))
    for index, item in enumerate(value):
        memory[index] = _to1(item, scope)
    return _T8(_c.addressof(memory) if len(value) else None, len(value), None, None)

def _from8(value, scope):
    scope.charge(1, _c.sizeof(_T8))
    scope.charge(value.length, max(8, _c.sizeof(_T1)))
    if value.length and not value.data: raise LeanBridgeError(5, "Native array has a missing buffer")
    if value.length and value.data % _c.alignment(_T1): raise LeanBridgeError(5, "Native array has a misaligned buffer")
    memory = (_T1 * value.length).from_address(value.data) if value.length else ()
    return tuple(_from1(item, scope) for item in memory)


def _call0(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T2()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn0(input0, _c.byref(output), _c.byref(error)), error, scope)
        return _from2(output, scope)
    finally:
        try:
            _clear2(_c.byref(output))
        finally:
            scope.close()

def _call1(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T3()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn1(input0, _c.byref(output), _c.byref(error)), error, scope)
        return _from3(output, scope)
    finally:
        try:
            _clear3(_c.byref(output))
        finally:
            scope.close()

def _call2():
    _ensure_process()
    scope = _Scope()
    output = _T4()
    error = _Error()
    try:

        _check(_fn2(_c.byref(output), _c.byref(error)), error, scope)
        return _from4(output, scope)
    finally:
        try:
            _clear4(_c.byref(output))
        finally:
            scope.close()

def _call3():
    _ensure_process()
    scope = _Scope()
    output = _T6()
    error = _Error()
    try:

        _check(_fn3(_c.byref(output), _c.byref(error)), error, scope)
        return _from6(output, scope)
    finally:
        try:
            _clear6(_c.byref(output))
        finally:
            scope.close()

def _call4():
    _ensure_process()
    scope = _Scope()
    output = _T1()
    error = _Error()
    try:

        _check(_fn4(_c.byref(output), _c.byref(error)), error, scope)
        return _from1(output, scope)
    finally:
        try:
            _clear1(_c.byref(output))
        finally:
            scope.close()

def _call5(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T8()
    error = _Error()
    try:
        input0 = _to7(_arg0, scope)
        _check(_fn5(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from8(output, scope)
    finally:
        try:
            _clear8(_c.byref(output))
        finally:
            scope.close()
