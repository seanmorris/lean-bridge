import ctypes as _c
from . import LeanBridgeError, Some, Packet

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
_libraries = {"libnestedcheckedrecords.so":"b47fe7b884ba06a3dbe90916139625b89bb3edda9389205d080e92e7de06d903","libcomponent_a63244d529ededa079e7.so":"960bf714f5e9633c5e75df7692c33af63e6d467f8e1f9d63d0d1fef300596de8","liblean_bridge_native.so":"25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7","libleanshared.so":"d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4"}
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
    if _state.identity not in (None, "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf"):
        raise ImportError("Incompatible Lean runtime identities")
    for _name, _expected in _libraries.items():
        if _state.libraries.get(_name, _expected) != _expected:
            raise ImportError("Conflicting builds of the same native library: " + _name)
    _previous = _state.components.get("nestedcheckedrecords@1.0.0")
    if _previous is not None and _previous[0] != "103e61aa2b5ec8ba9b9cdd5437b05ebc258460ccc7f6a9c01cc63469cdf29b4e":
        raise ImportError("Conflicting builds of the same Lean component")
    try:
        if _previous is None:
            for _name in ["libleanshared.so","liblean_bridge_native.so","libcomponent_a63244d529ededa079e7.so","libnestedcheckedrecords.so"]:
                if _name not in _state.libraries:
                    _loaded = _c.CDLL(str(_root / _name), mode=_os.RTLD_NOW | _os.RTLD_GLOBAL)
                    _state.handles.append(_loaded)
                    _state.libraries[_name] = _libraries[_name]
                else:
                    _loaded = next(item for item in _state.handles if _pathlib.Path(item._name).name == _name)
            _previous = ("103e61aa2b5ec8ba9b9cdd5437b05ebc258460ccc7f6a9c01cc63469cdf29b4e", _loaded)
            _state.components["nestedcheckedrecords@1.0.0"] = _previous
            _state.identity = "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf"
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
    _fields_ = [("digit", _T0), ("word", _T0)]

class _T2(_c.Structure):
    _fields_ = [("data", _c.c_void_p), ("length", _c.c_size_t), ("owner", _c.c_void_p), ("release", _c.c_void_p)]

class _T3(_c.Structure):
    _fields_ = [("has_value", _c.c_uint8), ("value", _T1)]

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


_clear0 = _LIBRARY["nestedcheckedrecords_nat_clear"]
_clear0.argtypes = [_c.POINTER(_T0)]
_clear0.restype = None
_clear1 = _LIBRARY["nestedcheckedrecords_packet_clear"]
_clear1.argtypes = [_c.POINTER(_T1)]
_clear1.restype = None
_clear2 = _LIBRARY["nestedcheckedrecords_array_lean_nested_checked_records_packet_span_clear"]
_clear2.argtypes = [_c.POINTER(_T2)]
_clear2.restype = None
_clear3 = _LIBRARY["nestedcheckedrecords_option_lean_nested_checked_records_packet_value_clear"]
_clear3.argtypes = [_c.POINTER(_T3)]
_clear3.restype = None
_fn0 = _LIBRARY["nestedcheckedrecords_produce_array"]
_fn0.argtypes = [_c.POINTER(_T0), _c.POINTER(_T2), _c.POINTER(_Error)]
_fn0.restype = _c.c_int
_fn1 = _LIBRARY["nestedcheckedrecords_produce_option"]
_fn1.argtypes = [_c.POINTER(_T0), _c.POINTER(_T3), _c.POINTER(_Error)]
_fn1.restype = _c.c_int

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
    if type(value) is not Packet: raise TypeError("Expected Packet")
    return _T1(_to0(value.digit, scope), _to0(value.word, scope))

def _from1(value, scope):
    scope.charge(1, _c.sizeof(_T1))
    return Packet(digit=_from0(value.digit, scope), word=_from0(value.word, scope))

def _to2(value, scope):
    scope.charge(1, _c.sizeof(_T2))
    if type(value) not in (tuple, list): raise TypeError("Expected a tuple or list")
    scope.charge(len(value), 8)
    value = tuple(value)
    memory = scope.allocate(_T1, len(value))
    for index, item in enumerate(value):
        memory[index] = _to1(item, scope)
    return _T2(_c.addressof(memory) if len(value) else None, len(value), None, None)

def _from2(value, scope):
    scope.charge(1, _c.sizeof(_T2))
    scope.charge(value.length, max(8, _c.sizeof(_T1)))
    if value.length and not value.data: raise LeanBridgeError(5, "Native array has a missing buffer")
    if value.length and value.data % _c.alignment(_T1): raise LeanBridgeError(5, "Native array has a misaligned buffer")
    memory = (_T1 * value.length).from_address(value.data) if value.length else ()
    return tuple(_from1(item, scope) for item in memory)

def _to3(value, scope):
    scope.charge(1, _c.sizeof(_T3))
    if value is None: return _T3()
    if type(value) is not Some: raise TypeError("Option requires None or Some(value)")
    return _T3(1, _to1(value.value, scope))

def _from3(value, scope):
    scope.charge(1, _c.sizeof(_T3))
    if value.has_value > 1: raise LeanBridgeError(5, "Invalid native option flag")
    return Some(_from1(value.value, scope)) if value.has_value else None


def _call0(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T2()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn0(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
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
        _check(_fn1(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from3(output, scope)
    finally:
        try:
            _clear3(_c.byref(output))
        finally:
            scope.close()
