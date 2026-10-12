import ctypes as _c
from . import LeanBridgeError, Some, Ok, Err, Envelope, Event, EventEmpty, EventBox, EventChoices, AliasPair, Pair

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
_libraries = {"libnominalsubtypes.so":"d9f17b465ff4953a63c323967e40f954b118cde8bafd64e3ce03facb70cc3336","libcomponent_7f8bfe55e5831a9133c5.so":"87a82e65ee3397dcdf3de0fe28da6fc4d13593860b9126f1fe1fe0ef143e302c","liblean_bridge_native.so":"25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7","libleanshared.so":"d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4"}
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
    _previous = _state.components.get("nominalsubtypes@1.0.0")
    if _previous is not None and _previous[0] != "243b2169fe31d19928a0f5eb20b89f525690d211740d53b7fcab7305c272ac66":
        raise ImportError("Conflicting builds of the same Lean component")
    try:
        if _previous is None:
            for _name in ["libleanshared.so","liblean_bridge_native.so","libcomponent_7f8bfe55e5831a9133c5.so","libnominalsubtypes.so"]:
                if _name not in _state.libraries:
                    _loaded = _c.CDLL(str(_root / _name), mode=_os.RTLD_NOW | _os.RTLD_GLOBAL)
                    _state.handles.append(_loaded)
                    _state.libraries[_name] = _libraries[_name]
                else:
                    _loaded = next(item for item in _state.handles if _pathlib.Path(item._name).name == _name)
            _previous = ("243b2169fe31d19928a0f5eb20b89f525690d211740d53b7fcab7305c272ac66", _loaded)
            _state.components["nominalsubtypes@1.0.0"] = _previous
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
    _fields_ = [("payload", _T0), ("digit", _T0)]

class _T2(_c.Structure):
    _fields_ = [("has_value", _c.c_uint8), ("value", _T1)]

class _T3(_c.Structure):
    _fields_ = [("data", _c.c_void_p), ("length", _c.c_size_t), ("owner", _c.c_void_p), ("release", _c.c_void_p)]

class _T4(_c.Structure):
    _fields_ = [("data", _c.c_void_p), ("length", _c.c_size_t), ("owner", _c.c_void_p), ("release", _c.c_void_p)]

class _T5(_c.Structure):
    _fields_ = [("is_ok", _c.c_uint8), ("ok", _T0), ("error", _T0)]

class _T6(_c.Structure):
    _fields_ = [("has_value", _c.c_uint8), ("value", _T5)]

class _T7(_c.Structure):
    _fields_ = [("data", _c.c_void_p), ("length", _c.c_size_t), ("owner", _c.c_void_p), ("release", _c.c_void_p)]

class _V8_0(_c.Structure):
    _fields_ = [("empty", _c.c_uint8)]

class _V8_1(_c.Structure):
    _fields_ = [("value", _T1)]

class _V8_2(_c.Structure):
    _fields_ = [("values", _T7)]

class _V8(_c.Union):
    _fields_ = [("case0", _V8_0), ("case1", _V8_1), ("case2", _V8_2)]

class _T8(_c.Structure):
    _fields_ = [("kind", _c.c_uint32), ("cases", _V8)]

class _T9(_c.Structure):
    _fields_ = [("left", _T3), ("right", _T3)]

class _T10(_c.Structure):
    _fields_ = [("data", _c.c_void_p), ("length", _c.c_size_t), ("owner", _c.c_void_p), ("release", _c.c_void_p)]

class _T11(_c.Structure):
    _fields_ = [("left", _T1), ("right", _T1)]

class _T12(_c.Structure):
    _fields_ = [("has_value", _c.c_uint8), ("value", _T0)]

class _T13(_c.Structure):
    _fields_ = [("fst", _T0), ("snd", _T0)]

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


_clear0 = _LIBRARY["nominalsubtypes_nat_clear"]
_clear0.argtypes = [_c.POINTER(_T0)]
_clear0.restype = None
_clear1 = _LIBRARY["nominalsubtypes_envelope_clear"]
_clear1.argtypes = [_c.POINTER(_T1)]
_clear1.restype = None
_clear2 = _LIBRARY["nominalsubtypes_option_lean_nominal_subtypes_envelope_value_clear"]
_clear2.argtypes = [_c.POINTER(_T2)]
_clear2.restype = None
_clear3 = _LIBRARY["nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span_clear"]
_clear3.argtypes = [_c.POINTER(_T3)]
_clear3.restype = None
_clear4 = _LIBRARY["nominalsubtypes_array_nat_span_clear"]
_clear4.argtypes = [_c.POINTER(_T4)]
_clear4.restype = None
_clear5 = _LIBRARY["nominalsubtypes_result_nat_nat_value_clear"]
_clear5.argtypes = [_c.POINTER(_T5)]
_clear5.restype = None
_clear6 = _LIBRARY["nominalsubtypes_option_result_nat_nat_value_clear"]
_clear6.argtypes = [_c.POINTER(_T6)]
_clear6.restype = None
_clear7 = _LIBRARY["nominalsubtypes_array_option_result_nat_nat_span_clear"]
_clear7.argtypes = [_c.POINTER(_T7)]
_clear7.restype = None
_clear8 = _LIBRARY["nominalsubtypes_event_clear"]
_clear8.argtypes = [_c.POINTER(_T8)]
_clear8.restype = None
_clear9 = _LIBRARY["nominalsubtypes_alias_pair_clear"]
_clear9.argtypes = [_c.POINTER(_T9)]
_clear9.restype = None
_clear10 = _LIBRARY["nominalsubtypes_list_nat_span_clear"]
_clear10.argtypes = [_c.POINTER(_T10)]
_clear10.restype = None
_clear11 = _LIBRARY["nominalsubtypes_pair_clear"]
_clear11.argtypes = [_c.POINTER(_T11)]
_clear11.restype = None
_clear12 = _LIBRARY["nominalsubtypes_option_nat_value_clear"]
_clear12.argtypes = [_c.POINTER(_T12)]
_clear12.restype = None
_clear13 = _LIBRARY["nominalsubtypes_tuple_nat_nat_value_clear"]
_clear13.argtypes = [_c.POINTER(_T13)]
_clear13.restype = None
_fn0 = _LIBRARY["nominalsubtypes_aliases"]
_fn0.argtypes = [_c.POINTER(_T3), _c.POINTER(_T3), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn0.restype = _c.c_int
_fn1 = _LIBRARY["nominalsubtypes_array_values"]
_fn1.argtypes = [_c.POINTER(_T0), _c.POINTER(_T4), _c.POINTER(_Error)]
_fn1.restype = _c.c_int
_fn2 = _LIBRARY["nominalsubtypes_branch"]
_fn2.argtypes = [_c.POINTER(_T0), _c.POINTER(_T5), _c.POINTER(_Error)]
_fn2.restype = _c.c_int
_fn3 = _LIBRARY["nominalsubtypes_combine"]
_fn3.argtypes = [_c.POINTER(_T1), _c.POINTER(_T1), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn3.restype = _c.c_int
_fn4 = _LIBRARY["nominalsubtypes_echo"]
_fn4.argtypes = [_c.POINTER(_T1), _c.POINTER(_T1), _c.POINTER(_Error)]
_fn4.restype = _c.c_int
_fn5 = _LIBRARY["nominalsubtypes_echo_event"]
_fn5.argtypes = [_c.POINTER(_T8), _c.POINTER(_T8), _c.POINTER(_Error)]
_fn5.restype = _c.c_int
_fn6 = _LIBRARY["nominalsubtypes_echo_groups"]
_fn6.argtypes = [_c.POINTER(_T3), _c.POINTER(_T3), _c.POINTER(_Error)]
_fn6.restype = _c.c_int
_fn7 = _LIBRARY["nominalsubtypes_echo_pair"]
_fn7.argtypes = [_c.POINTER(_T9), _c.POINTER(_T9), _c.POINTER(_Error)]
_fn7.restype = _c.c_int
_fn8 = _LIBRARY["nominalsubtypes_event_choices"]
_fn8.argtypes = [_c.POINTER(_T0), _c.POINTER(_T8), _c.POINTER(_Error)]
_fn8.restype = _c.c_int
_fn9 = _LIBRARY["nominalsubtypes_event_empty"]
_fn9.argtypes = [_c.POINTER(_T0), _c.POINTER(_T8), _c.POINTER(_Error)]
_fn9.restype = _c.c_int
_fn10 = _LIBRARY["nominalsubtypes_event_first"]
_fn10.argtypes = [_c.POINTER(_T8), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn10.restype = _c.c_int
_fn11 = _LIBRARY["nominalsubtypes_event_second"]
_fn11.argtypes = [_c.POINTER(_T8), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn11.restype = _c.c_int
_fn12 = _LIBRARY["nominalsubtypes_event_value"]
_fn12.argtypes = [_c.POINTER(_T0), _c.POINTER(_T8), _c.POINTER(_Error)]
_fn12.restype = _c.c_int
_fn13 = _LIBRARY["nominalsubtypes_first"]
_fn13.argtypes = [_c.POINTER(_T1), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn13.restype = _c.c_int
_fn14 = _LIBRARY["nominalsubtypes_group_values"]
_fn14.argtypes = [_c.POINTER(_T0), _c.POINTER(_T3), _c.POINTER(_Error)]
_fn14.restype = _c.c_int
_fn15 = _LIBRARY["nominalsubtypes_inspect_alias_pair"]
_fn15.argtypes = [_c.POINTER(_T9), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn15.restype = _c.c_int
_fn16 = _LIBRARY["nominalsubtypes_list_values"]
_fn16.argtypes = [_c.POINTER(_T0), _c.POINTER(_T10), _c.POINTER(_Error)]
_fn16.restype = _c.c_int
_fn17 = _LIBRARY["nominalsubtypes_nested"]
_fn17.argtypes = [_c.POINTER(_T11), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn17.restype = _c.c_int
_fn18 = _LIBRARY["nominalsubtypes_no_items"]
_fn18.argtypes = [_c.POINTER(_T0), _c.POINTER(_T4), _c.POINTER(_Error)]
_fn18.restype = _c.c_int
_fn19 = _LIBRARY["nominalsubtypes_optional"]
_fn19.argtypes = [_c.POINTER(_T0), _c.POINTER(_T12), _c.POINTER(_Error)]
_fn19.restype = _c.c_int
_fn20 = _LIBRARY["nominalsubtypes_pair_values"]
_fn20.argtypes = [_c.POINTER(_T0), _c.POINTER(_T9), _c.POINTER(_Error)]
_fn20.restype = _c.c_int
_fn21 = _LIBRARY["nominalsubtypes_plain_fin"]
_fn21.argtypes = [_c.POINTER(_T0), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn21.restype = _c.c_int
_fn22 = _LIBRARY["nominalsubtypes_produce_envelope"]
_fn22.argtypes = [_c.POINTER(_T0), _c.POINTER(_T1), _c.POINTER(_Error)]
_fn22.restype = _c.c_int
_fn23 = _LIBRARY["nominalsubtypes_product"]
_fn23.argtypes = [_c.POINTER(_T0), _c.POINTER(_T13), _c.POINTER(_Error)]
_fn23.restype = _c.c_int
_fn24 = _LIBRARY["nominalsubtypes_scalar"]
_fn24.argtypes = [_c.POINTER(_T0), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn24.restype = _c.c_int
_fn25 = _LIBRARY["nominalsubtypes_second"]
_fn25.argtypes = [_c.POINTER(_T1), _c.POINTER(_T0), _c.POINTER(_Error)]
_fn25.restype = _c.c_int

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
    if type(value) is not Envelope: raise TypeError("Expected Envelope")
    return _T1(_to0(value.payload, scope), _to0(value.digit, scope))

def _from1(value, scope):
    scope.charge(1, _c.sizeof(_T1))
    return Envelope(payload=_from0(value.payload, scope), digit=_from0(value.digit, scope))

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
    if type(value) not in (tuple, list): raise TypeError("Expected a tuple or list")
    scope.charge(len(value), 8)
    value = tuple(value)
    memory = scope.allocate(_T2, len(value))
    for index, item in enumerate(value):
        memory[index] = _to2(item, scope)
    return _T3(_c.addressof(memory) if len(value) else None, len(value), None, None)

def _from3(value, scope):
    scope.charge(1, _c.sizeof(_T3))
    scope.charge(value.length, max(8, _c.sizeof(_T2)))
    if value.length and not value.data: raise LeanBridgeError(5, "Native array has a missing buffer")
    if value.length and value.data % _c.alignment(_T2): raise LeanBridgeError(5, "Native array has a misaligned buffer")
    memory = (_T2 * value.length).from_address(value.data) if value.length else ()
    return tuple(_from2(item, scope) for item in memory)

def _to4(value, scope):
    scope.charge(1, _c.sizeof(_T4))
    if type(value) not in (tuple, list): raise TypeError("Expected a tuple or list")
    scope.charge(len(value), 8)
    value = tuple(value)
    memory = scope.allocate(_T0, len(value))
    for index, item in enumerate(value):
        memory[index] = _to0(item, scope)
    return _T4(_c.addressof(memory) if len(value) else None, len(value), None, None)

def _from4(value, scope):
    scope.charge(1, _c.sizeof(_T4))
    scope.charge(value.length, max(8, _c.sizeof(_T0)))
    if value.length and not value.data: raise LeanBridgeError(5, "Native array has a missing buffer")
    if value.length and value.data % _c.alignment(_T0): raise LeanBridgeError(5, "Native array has a misaligned buffer")
    memory = (_T0 * value.length).from_address(value.data) if value.length else ()
    return tuple(_from0(item, scope) for item in memory)

def _to5(value, scope):
    scope.charge(1, _c.sizeof(_T5))
    if type(value) is Ok: return _T5(is_ok=1, ok=_to0(value.value, scope))
    if type(value) is Err: return _T5(error=_to0(value.value, scope))
    raise TypeError("Result requires Ok(value) or Err(value)")

def _from5(value, scope):
    scope.charge(1, _c.sizeof(_T5))
    if value.is_ok > 1: raise LeanBridgeError(5, "Invalid native result flag")
    return Ok(_from0(value.ok, scope)) if value.is_ok else Err(_from0(value.error, scope))

def _to6(value, scope):
    scope.charge(1, _c.sizeof(_T6))
    if value is None: return _T6()
    if type(value) is not Some: raise TypeError("Option requires None or Some(value)")
    return _T6(1, _to5(value.value, scope))

def _from6(value, scope):
    scope.charge(1, _c.sizeof(_T6))
    if value.has_value > 1: raise LeanBridgeError(5, "Invalid native option flag")
    return Some(_from5(value.value, scope)) if value.has_value else None

def _to7(value, scope):
    scope.charge(1, _c.sizeof(_T7))
    if type(value) not in (tuple, list): raise TypeError("Expected a tuple or list")
    scope.charge(len(value), 8)
    value = tuple(value)
    memory = scope.allocate(_T6, len(value))
    for index, item in enumerate(value):
        memory[index] = _to6(item, scope)
    return _T7(_c.addressof(memory) if len(value) else None, len(value), None, None)

def _from7(value, scope):
    scope.charge(1, _c.sizeof(_T7))
    scope.charge(value.length, max(8, _c.sizeof(_T6)))
    if value.length and not value.data: raise LeanBridgeError(5, "Native array has a missing buffer")
    if value.length and value.data % _c.alignment(_T6): raise LeanBridgeError(5, "Native array has a misaligned buffer")
    memory = (_T6 * value.length).from_address(value.data) if value.length else ()
    return tuple(_from6(item, scope) for item in memory)

def _to8(value, scope):
    scope.charge(1, _c.sizeof(_T8))
    if type(value) is EventEmpty:
        return _T8(kind=0, cases=_V8(case0=_V8_0()))
    if type(value) is EventBox:
        return _T8(kind=1, cases=_V8(case1=_V8_1(value=_to1(value.value, scope))))
    if type(value) is EventChoices:
        return _T8(kind=2, cases=_V8(case2=_V8_2(values=_to7(value.values, scope))))
    raise TypeError("Expected a named Event constructor")

def _from8(value, scope):
    scope.charge(1, _c.sizeof(_T8))
    if value.kind == 0:
        return EventEmpty()
    if value.kind == 1:
        return EventBox(value=_from1(value.cases.case1.value, scope))
    if value.kind == 2:
        return EventChoices(values=_from7(value.cases.case2.values, scope))
    raise LeanBridgeError(5, "Invalid native Event constructor")

def _to9(value, scope):
    scope.charge(1, _c.sizeof(_T9))
    if type(value) is not AliasPair: raise TypeError("Expected AliasPair")
    return _T9(_to3(value.left, scope), _to3(value.right, scope))

def _from9(value, scope):
    scope.charge(1, _c.sizeof(_T9))
    return AliasPair(left=_from3(value.left, scope), right=_from3(value.right, scope))

def _to10(value, scope):
    scope.charge(1, _c.sizeof(_T10))
    if type(value) not in (tuple, list): raise TypeError("Expected a tuple or list")
    scope.charge(len(value), 8)
    value = tuple(value)
    memory = scope.allocate(_T0, len(value))
    for index, item in enumerate(value):
        memory[index] = _to0(item, scope)
    return _T10(_c.addressof(memory) if len(value) else None, len(value), None, None)

def _from10(value, scope):
    scope.charge(1, _c.sizeof(_T10))
    scope.charge(value.length, max(8, _c.sizeof(_T0)))
    if value.length and not value.data: raise LeanBridgeError(5, "Native array has a missing buffer")
    if value.length and value.data % _c.alignment(_T0): raise LeanBridgeError(5, "Native array has a misaligned buffer")
    memory = (_T0 * value.length).from_address(value.data) if value.length else ()
    return tuple(_from0(item, scope) for item in memory)

def _to11(value, scope):
    scope.charge(1, _c.sizeof(_T11))
    if type(value) is not Pair: raise TypeError("Expected Pair")
    return _T11(_to1(value.left, scope), _to1(value.right, scope))

def _from11(value, scope):
    scope.charge(1, _c.sizeof(_T11))
    return Pair(left=_from1(value.left, scope), right=_from1(value.right, scope))

def _to12(value, scope):
    scope.charge(1, _c.sizeof(_T12))
    if value is None: return _T12()
    if type(value) is not Some: raise TypeError("Option requires None or Some(value)")
    return _T12(1, _to0(value.value, scope))

def _from12(value, scope):
    scope.charge(1, _c.sizeof(_T12))
    if value.has_value > 1: raise LeanBridgeError(5, "Invalid native option flag")
    return Some(_from0(value.value, scope)) if value.has_value else None

def _to13(value, scope):
    scope.charge(1, _c.sizeof(_T13))
    if type(value) is not tuple: raise TypeError("Prod requires a two-element tuple")
    if len(value) != 2: raise ValueError("Prod requires exactly two elements")
    return _T13(_to0(value[0], scope), _to0(value[1], scope))

def _from13(value, scope):
    scope.charge(1, _c.sizeof(_T13))
    return (_from0(value.fst, scope), _from0(value.snd, scope))


def _call0(_arg0, _arg1):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to3(_arg0, scope)
        input1 = _to3(_arg1, scope)
        _check(_fn0(_c.byref(input0), _c.byref(input1), _c.byref(output), _c.byref(error)), error, scope)
        return _from0(output, scope)
    finally:
        try:
            _clear0(_c.byref(output))
        finally:
            scope.close()

def _call1(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T4()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn1(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from4(output, scope)
    finally:
        try:
            _clear4(_c.byref(output))
        finally:
            scope.close()

def _call2(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T5()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn2(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from5(output, scope)
    finally:
        try:
            _clear5(_c.byref(output))
        finally:
            scope.close()

def _call3(_arg0, _arg1):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to1(_arg0, scope)
        input1 = _to1(_arg1, scope)
        _check(_fn3(_c.byref(input0), _c.byref(input1), _c.byref(output), _c.byref(error)), error, scope)
        return _from0(output, scope)
    finally:
        try:
            _clear0(_c.byref(output))
        finally:
            scope.close()

def _call4(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T1()
    error = _Error()
    try:
        input0 = _to1(_arg0, scope)
        _check(_fn4(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
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
        input0 = _to8(_arg0, scope)
        _check(_fn5(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from8(output, scope)
    finally:
        try:
            _clear8(_c.byref(output))
        finally:
            scope.close()

def _call6(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T3()
    error = _Error()
    try:
        input0 = _to3(_arg0, scope)
        _check(_fn6(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from3(output, scope)
    finally:
        try:
            _clear3(_c.byref(output))
        finally:
            scope.close()

def _call7(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T9()
    error = _Error()
    try:
        input0 = _to9(_arg0, scope)
        _check(_fn7(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from9(output, scope)
    finally:
        try:
            _clear9(_c.byref(output))
        finally:
            scope.close()

def _call8(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T8()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn8(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from8(output, scope)
    finally:
        try:
            _clear8(_c.byref(output))
        finally:
            scope.close()

def _call9(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T8()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn9(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from8(output, scope)
    finally:
        try:
            _clear8(_c.byref(output))
        finally:
            scope.close()

def _call10(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to8(_arg0, scope)
        _check(_fn10(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from0(output, scope)
    finally:
        try:
            _clear0(_c.byref(output))
        finally:
            scope.close()

def _call11(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to8(_arg0, scope)
        _check(_fn11(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from0(output, scope)
    finally:
        try:
            _clear0(_c.byref(output))
        finally:
            scope.close()

def _call12(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T8()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn12(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from8(output, scope)
    finally:
        try:
            _clear8(_c.byref(output))
        finally:
            scope.close()

def _call13(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to1(_arg0, scope)
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
    output = _T3()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn14(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from3(output, scope)
    finally:
        try:
            _clear3(_c.byref(output))
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

def _call16(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T10()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn16(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from10(output, scope)
    finally:
        try:
            _clear10(_c.byref(output))
        finally:
            scope.close()

def _call17(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to11(_arg0, scope)
        _check(_fn17(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from0(output, scope)
    finally:
        try:
            _clear0(_c.byref(output))
        finally:
            scope.close()

def _call18(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T4()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn18(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from4(output, scope)
    finally:
        try:
            _clear4(_c.byref(output))
        finally:
            scope.close()

def _call19(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T12()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn19(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from12(output, scope)
    finally:
        try:
            _clear12(_c.byref(output))
        finally:
            scope.close()

def _call20(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T9()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn20(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from9(output, scope)
    finally:
        try:
            _clear9(_c.byref(output))
        finally:
            scope.close()

def _call21(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn21(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from0(output, scope)
    finally:
        try:
            _clear0(_c.byref(output))
        finally:
            scope.close()

def _call22(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T1()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn22(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from1(output, scope)
    finally:
        try:
            _clear1(_c.byref(output))
        finally:
            scope.close()

def _call23(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T13()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn23(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from13(output, scope)
    finally:
        try:
            _clear13(_c.byref(output))
        finally:
            scope.close()

def _call24(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to0(_arg0, scope)
        _check(_fn24(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from0(output, scope)
    finally:
        try:
            _clear0(_c.byref(output))
        finally:
            scope.close()

def _call25(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T0()
    error = _Error()
    try:
        input0 = _to1(_arg0, scope)
        _check(_fn25(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from0(output, scope)
    finally:
        try:
            _clear0(_c.byref(output))
        finally:
            scope.close()
