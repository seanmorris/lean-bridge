import ctypes as _c
from . import LeanBridgeError, Ab, EmptySized, EmptyToken, Off, On, UnicodeToken, WideToken, ZeroToken

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
_libraries = {"libcheckedrecordvalueindices.so":"fdcddf87c8fdd6f792ecda1b280d4d23ef8a6c0e6c01aa0eb346c2c33dcf34da","libcomponent_767c615eabad08d77709.so":"39941bbf2ec5f61793b17581a6f4e1e79725ec63f2fd2a6d5a5cbfa7274ae1e6","liblean_bridge_native.so":"459fcd2098d4b646ab6ae0f4cdccd1f222908cb162562bfc3940a533cd4e4e21","libleanshared.so":"d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4"}
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
    _previous = _state.components.get("checkedrecordvalueindices@1.0.0")
    if _previous is not None and _previous[0] != "2ab4e5310eaf50f0795a34e419c54fe546394a7c7b4dd2c71d2eaa3ac956682a":
        raise ImportError("Conflicting builds of the same Lean component")
    try:
        if _previous is None:
            for _name in ["libleanshared.so","liblean_bridge_native.so","libcomponent_767c615eabad08d77709.so","libcheckedrecordvalueindices.so"]:
                if _name not in _state.libraries:
                    _loaded = _c.CDLL(str(_root / _name), mode=_os.RTLD_NOW | _os.RTLD_GLOBAL)
                    _state.handles.append(_loaded)
                    _state.libraries[_name] = _libraries[_name]
                else:
                    _loaded = next(item for item in _state.handles if _pathlib.Path(item._name).name == _name)
            _previous = ("2ab4e5310eaf50f0795a34e419c54fe546394a7c7b4dd2c71d2eaa3ac956682a", _loaded)
            _state.components["checkedrecordvalueindices@1.0.0"] = _previous
            _state.identity = "4b5a7fdf0cb11d4bb429181cfd50b330c5622ed8f5f5382a293955a439b595b5"
        _LIBRARY = _previous[1]
    except BaseException:
        _state.failed = True
        raise

def _ensure_process():
    if _os.getpid() != _PID:
        raise RuntimeError("Start a fresh Python interpreter after fork to use Lean packages")

class _T0(_c.Structure):
    _fields_ = [("data", _c.c_void_p), ("length", _c.c_size_t), ("owner", _c.c_void_p), ("release", _c.c_void_p)]

class _T1(_c.Structure):
    _fields_ = [("size", _T0)]

class _T2(_c.Structure):
    _fields_ = [("data", _c.c_void_p), ("length", _c.c_size_t), ("owner", _c.c_void_p), ("release", _c.c_void_p)]

class _T3(_c.Structure):
    _fields_ = [("data", _T2)]

class _T4(_c.Structure):
    _fields_ = [("count", _T0)]

class _T5(_c.Structure):
    _fields_ = [("count", _T0)]

class _T6(_c.Structure):
    _fields_ = [("count", _T0)]

class _T7(_c.Structure):
    _fields_ = [("count", _T0)]

class _T8(_c.Structure):
    _fields_ = [("count", _T0)]

class _T9(_c.Structure):
    _fields_ = [("count", _T0)]

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


_clear0 = _LIBRARY["checkedrecordvalueindices_nat_clear"]
_clear0.argtypes = [_c.POINTER(_T0)]
_clear0.restype = None
_clear1 = _LIBRARY["checkedrecordvalueindices_ab_clear"]
_clear1.argtypes = [_c.POINTER(_T1)]
_clear1.restype = None
_clear2 = _LIBRARY["checkedrecordvalueindices_array_nat_span_clear"]
_clear2.argtypes = [_c.POINTER(_T2)]
_clear2.restype = None
_clear3 = _LIBRARY["checkedrecordvalueindices_empty_sized_clear"]
_clear3.argtypes = [_c.POINTER(_T3)]
_clear3.restype = None
_clear4 = _LIBRARY["checkedrecordvalueindices_empty_token_clear"]
_clear4.argtypes = [_c.POINTER(_T4)]
_clear4.restype = None
_clear5 = _LIBRARY["checkedrecordvalueindices_off_clear"]
_clear5.argtypes = [_c.POINTER(_T5)]
_clear5.restype = None
_clear6 = _LIBRARY["checkedrecordvalueindices_on_clear"]
_clear6.argtypes = [_c.POINTER(_T6)]
_clear6.restype = None
_clear7 = _LIBRARY["checkedrecordvalueindices_unicode_token_clear"]
_clear7.argtypes = [_c.POINTER(_T7)]
_clear7.restype = None
_clear8 = _LIBRARY["checkedrecordvalueindices_wide_token_clear"]
_clear8.argtypes = [_c.POINTER(_T8)]
_clear8.restype = None
_clear9 = _LIBRARY["checkedrecordvalueindices_zero_token_clear"]
_clear9.argtypes = [_c.POINTER(_T9)]
_clear9.restype = None
_fn0 = _LIBRARY["checkedrecordvalueindices_ab_string_index"]
_fn0.argtypes = [_c.POINTER(_T1), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn0.restype = _c.c_int
_fn1 = _LIBRARY["checkedrecordvalueindices_empty_sized_index"]
_fn1.argtypes = [_c.POINTER(_T3), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn1.restype = _c.c_int
_fn2 = _LIBRARY["checkedrecordvalueindices_empty_string_index"]
_fn2.argtypes = [_c.POINTER(_T4), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn2.restype = _c.c_int
_fn3 = _LIBRARY["checkedrecordvalueindices_false_bool_index"]
_fn3.argtypes = [_c.POINTER(_T5), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn3.restype = _c.c_int
_fn4 = _LIBRARY["checkedrecordvalueindices_produce_ab"]
_fn4.argtypes = [_c.POINTER(_T1), _c.POINTER(_Error)]
_fn4.restype = _c.c_int
_fn5 = _LIBRARY["checkedrecordvalueindices_produce_empty_sized"]
_fn5.argtypes = [_c.POINTER(_T3), _c.POINTER(_Error)]
_fn5.restype = _c.c_int
_fn6 = _LIBRARY["checkedrecordvalueindices_produce_empty_string"]
_fn6.argtypes = [_c.POINTER(_T0), _c.POINTER(_T4), _c.POINTER(_Error)]
_fn6.restype = _c.c_int
_fn7 = _LIBRARY["checkedrecordvalueindices_produce_false_bool"]
_fn7.argtypes = [_c.POINTER(_T5), _c.POINTER(_Error)]
_fn7.restype = _c.c_int
_fn8 = _LIBRARY["checkedrecordvalueindices_produce_true_bool"]
_fn8.argtypes = [_c.POINTER(_T6), _c.POINTER(_Error)]
_fn8.restype = _c.c_int
_fn9 = _LIBRARY["checkedrecordvalueindices_produce_unicode_string"]
_fn9.argtypes = [_c.POINTER(_T0), _c.POINTER(_T7), _c.POINTER(_Error)]
_fn9.restype = _c.c_int
_fn10 = _LIBRARY["checkedrecordvalueindices_produce_wide_nat"]
_fn10.argtypes = [_c.POINTER(_T0), _c.POINTER(_T8), _c.POINTER(_Error)]
_fn10.restype = _c.c_int
_fn11 = _LIBRARY["checkedrecordvalueindices_produce_zero_nat"]
_fn11.argtypes = [_c.POINTER(_T0), _c.POINTER(_T9), _c.POINTER(_Error)]
_fn11.restype = _c.c_int
_fn12 = _LIBRARY["checkedrecordvalueindices_true_bool_index"]
_fn12.argtypes = [_c.POINTER(_T6), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn12.restype = _c.c_int
_fn13 = _LIBRARY["checkedrecordvalueindices_unicode_string_index"]
_fn13.argtypes = [_c.POINTER(_T7), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn13.restype = _c.c_int
_fn14 = _LIBRARY["checkedrecordvalueindices_wide_nat_index"]
_fn14.argtypes = [_c.POINTER(_T8), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn14.restype = _c.c_int
_fn15 = _LIBRARY["checkedrecordvalueindices_zero_nat_index"]
_fn15.argtypes = [_c.POINTER(_T9), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn15.restype = _c.c_int

def _to0(value, scope):
    scope.charge(1, _c.sizeof(_T0))
    _integer(value, 0, None)
    length = (value.bit_length() + 31) // 32
    scope.charge(length, 4)
    data = abs(value).to_bytes(length * 4, "little")
    return _T0(_buffer(data, scope), length, None, None)

def _from0(value, scope):
    scope.charge(1, _c.sizeof(_T0))
    magnitude = int.from_bytes(_read(value.data, value.length * 4, scope, 2), "little")
    return magnitude

def _to1(value, scope):
    scope.charge(1, _c.sizeof(_T1))
    if type(value) is not Ab: raise TypeError("Expected Ab")
    return _T1(_to0(value.size, scope))

def _from1(value, scope):
    scope.charge(1, _c.sizeof(_T1))
    return Ab(size=_from0(value.size, scope))

def _to2(value, scope):
    scope.charge(1, _c.sizeof(_T2))
    if type(value) not in (tuple, list): raise TypeError("Expected a tuple or list")
    scope.charge(len(value), 8)
    value = tuple(value)
    memory = scope.allocate(_T0, len(value))
    for index, item in enumerate(value):
        memory[index] = _to0(item, scope)
    return _T2(_c.addressof(memory) if len(value) else None, len(value), None, None)

def _from2(value, scope):
    scope.charge(1, _c.sizeof(_T2))
    scope.charge(value.length, max(8, _c.sizeof(_T0)))
    if value.length and not value.data: raise LeanBridgeError(5, "Native array has a missing buffer")
    if value.length and value.data % _c.alignment(_T0): raise LeanBridgeError(5, "Native array has a misaligned buffer")
    memory = (_T0 * value.length).from_address(value.data) if value.length else ()
    return tuple(_from0(item, scope) for item in memory)

def _to3(value, scope):
    scope.charge(1, _c.sizeof(_T3))
    if type(value) is not EmptySized: raise TypeError("Expected EmptySized")
    return _T3(_to2(value.data, scope))

def _from3(value, scope):
    scope.charge(1, _c.sizeof(_T3))
    return EmptySized(data=_from2(value.data, scope))

def _to4(value, scope):
    scope.charge(1, _c.sizeof(_T4))
    if type(value) is not EmptyToken: raise TypeError("Expected EmptyToken")
    return _T4(_to0(value.count, scope))

def _from4(value, scope):
    scope.charge(1, _c.sizeof(_T4))
    return EmptyToken(count=_from0(value.count, scope))

def _to5(value, scope):
    scope.charge(1, _c.sizeof(_T5))
    if type(value) is not Off: raise TypeError("Expected Off")
    return _T5(_to0(value.count, scope))

def _from5(value, scope):
    scope.charge(1, _c.sizeof(_T5))
    return Off(count=_from0(value.count, scope))

def _to6(value, scope):
    scope.charge(1, _c.sizeof(_T6))
    if type(value) is not On: raise TypeError("Expected On")
    return _T6(_to0(value.count, scope))

def _from6(value, scope):
    scope.charge(1, _c.sizeof(_T6))
    return On(count=_from0(value.count, scope))

def _to7(value, scope):
    scope.charge(1, _c.sizeof(_T7))
    if type(value) is not UnicodeToken: raise TypeError("Expected UnicodeToken")
    return _T7(_to0(value.count, scope))

def _from7(value, scope):
    scope.charge(1, _c.sizeof(_T7))
    return UnicodeToken(count=_from0(value.count, scope))

def _to8(value, scope):
    scope.charge(1, _c.sizeof(_T8))
    if type(value) is not WideToken: raise TypeError("Expected WideToken")
    return _T8(_to0(value.count, scope))

def _from8(value, scope):
    scope.charge(1, _c.sizeof(_T8))
    return WideToken(count=_from0(value.count, scope))

def _to9(value, scope):
    scope.charge(1, _c.sizeof(_T9))
    if type(value) is not ZeroToken: raise TypeError("Expected ZeroToken")
    return _T9(_to0(value.count, scope))

def _from9(value, scope):
    scope.charge(1, _c.sizeof(_T9))
    return ZeroToken(count=_from0(value.count, scope))


def _call0(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to1(_arg0, scope)
        _check(_fn0(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from0(output, scope)
    finally:
        try:
            _clear0(_c.byref(output))
        finally:
            scope.close()

def _call1(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to3(_arg0, scope)
        _check(_fn1(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from0(output, scope)
    finally:
        try:
            _clear0(_c.byref(output))
        finally:
            scope.close()

def _call2(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to4(_arg0, scope)
        _check(_fn2(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from0(output, scope)
    finally:
        try:
            _clear0(_c.byref(output))
        finally:
            scope.close()

def _call3(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to5(_arg0, scope)
        _check(_fn3(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from0(output, scope)
    finally:
        try:
            _clear0(_c.byref(output))
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

def _call5():
    _ensure_process()
    scope = _Scope()
    output = _T3()
    error = _Error()
    try:

        _check(_fn5(_c.byref(output), _c.byref(error)), error, scope)
        return _from3(output, scope)
    finally:
        try:
            _clear3(_c.byref(output))
        finally:
            scope.close()

def _call6(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T4()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn6(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from4(output, scope)
    finally:
        try:
            _clear4(_c.byref(output))
        finally:
            scope.close()

def _call7():
    _ensure_process()
    scope = _Scope()
    output = _T5()
    error = _Error()
    try:

        _check(_fn7(_c.byref(output), _c.byref(error)), error, scope)
        return _from5(output, scope)
    finally:
        try:
            _clear5(_c.byref(output))
        finally:
            scope.close()

def _call8():
    _ensure_process()
    scope = _Scope()
    output = _T6()
    error = _Error()
    try:

        _check(_fn8(_c.byref(output), _c.byref(error)), error, scope)
        return _from6(output, scope)
    finally:
        try:
            _clear6(_c.byref(output))
        finally:
            scope.close()

def _call9(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T7()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn9(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from7(output, scope)
    finally:
        try:
            _clear7(_c.byref(output))
        finally:
            scope.close()

def _call10(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T8()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn10(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from8(output, scope)
    finally:
        try:
            _clear8(_c.byref(output))
        finally:
            scope.close()

def _call11(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T9()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn11(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from9(output, scope)
    finally:
        try:
            _clear9(_c.byref(output))
        finally:
            scope.close()

def _call12(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to6(_arg0, scope)
        _check(_fn12(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from0(output, scope)
    finally:
        try:
            _clear0(_c.byref(output))
        finally:
            scope.close()

def _call13(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to7(_arg0, scope)
        _check(_fn13(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from0(output, scope)
    finally:
        try:
            _clear0(_c.byref(output))
        finally:
            scope.close()

def _call14(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to8(_arg0, scope)
        _check(_fn14(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from0(output, scope)
    finally:
        try:
            _clear0(_c.byref(output))
        finally:
            scope.close()

def _call15(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to9(_arg0, scope)
        _check(_fn15(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from0(output, scope)
    finally:
        try:
            _clear0(_c.byref(output))
        finally:
            scope.close()
