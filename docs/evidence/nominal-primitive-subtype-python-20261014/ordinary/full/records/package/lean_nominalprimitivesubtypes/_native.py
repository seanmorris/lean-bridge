import ctypes as _c
from . import LeanBridgeError, Some, Ok, Err, Packet, Event, EventEmpty, EventBox, EventChoices, Pair, RawPacket

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
_libraries = {"libnominalprimitivesubtypes.so":"eb46ccf3accce434eca3d3071099d945d515ec305901040e05ec3e44264dd4f0","libcomponent_19ad06f04a0c2d39db76.so":"58a916198cb50e5bb7fab57554591812a8381960749e100c43effecedd0a3672","liblean_bridge_native.so":"25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7","libleanshared.so":"d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4"}
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
    _previous = _state.components.get("nominalprimitivesubtypes@1.0.0")
    if _previous is not None and _previous[0] != "a363a5bedd3e2ee1ccdf9ba0a1b95b5e5c11dc9effd6ce7ef8e74dafcf5400d8":
        raise ImportError("Conflicting builds of the same Lean component")
    try:
        if _previous is None:
            for _name in ["libleanshared.so","liblean_bridge_native.so","libcomponent_19ad06f04a0c2d39db76.so","libnominalprimitivesubtypes.so"]:
                if _name not in _state.libraries:
                    _loaded = _c.CDLL(str(_root / _name), mode=_os.RTLD_NOW | _os.RTLD_GLOBAL)
                    _state.handles.append(_loaded)
                    _state.libraries[_name] = _libraries[_name]
                else:
                    _loaded = next(item for item in _state.handles if _pathlib.Path(item._name).name == _name)
            _previous = ("a363a5bedd3e2ee1ccdf9ba0a1b95b5e5c11dc9effd6ce7ef8e74dafcf5400d8", _loaded)
            _state.components["nominalprimitivesubtypes@1.0.0"] = _previous
            _state.identity = "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf"
        _LIBRARY = _previous[1]
    except BaseException:
        _state.failed = True
        raise

def _ensure_process():
    if _os.getpid() != _PID:
        raise RuntimeError("Start a fresh Python interpreter after fork to use Lean packages")

class _T10(_c.Structure):
    _fields_ = [("data", _c.c_void_p), ("length", _c.c_size_t), ("owner", _c.c_void_p), ("release", _c.c_void_p)]

class _T11(_c.Structure):
    _fields_ = [("data", _c.c_void_p), ("length", _c.c_size_t), ("owner", _c.c_void_p), ("release", _c.c_void_p), ("negative", _c.c_bool)]

class _T14(_c.Structure):
    _fields_ = [("data", _c.c_void_p), ("length", _c.c_size_t), ("owner", _c.c_void_p), ("release", _c.c_void_p)]

class _T15(_c.Structure):
    _fields_ = [("data", _c.c_void_p), ("length", _c.c_size_t), ("owner", _c.c_void_p), ("release", _c.c_void_p)]

class _T19(_c.Structure):
    _fields_ = [("unit_value", _c.c_uint8), ("bool_value", _c.c_bool), ("uint8_value", _c.c_uint8), ("uint16_value", _c.c_uint16), ("uint32_value", _c.c_uint32), ("uint64_value", _c.c_uint64), ("int8_value", _c.c_int8), ("int16_value", _c.c_int16), ("int32_value", _c.c_int32), ("int64_value", _c.c_int64), ("nat_value", _T10), ("int_value", _T11), ("float32_value", _c.c_float), ("float64_value", _c.c_double), ("text_value", _T14), ("bytes_value", _T15), ("char_value", _c.c_uint32), ("usize_value", _c.c_uint64), ("isize_value", _c.c_int64), ("digit", _T10)]

class _T20(_c.Structure):
    _fields_ = [("has_value", _c.c_uint8), ("value", _T19)]

class _T21(_c.Structure):
    _fields_ = [("data", _c.c_void_p), ("length", _c.c_size_t), ("owner", _c.c_void_p), ("release", _c.c_void_p)]

class _T22(_c.Structure):
    _fields_ = [("fst", _T19), ("snd", _T19)]

class _T23(_c.Structure):
    _fields_ = [("is_ok", _c.c_uint8), ("ok", _T19), ("error", _T19)]

class _T24(_c.Structure):
    _fields_ = [("has_value", _c.c_uint8), ("value", _T23)]

class _T25(_c.Structure):
    _fields_ = [("data", _c.c_void_p), ("length", _c.c_size_t), ("owner", _c.c_void_p), ("release", _c.c_void_p)]

class _V26_0(_c.Structure):
    _fields_ = [("empty", _c.c_uint8)]

class _V26_1(_c.Structure):
    _fields_ = [("value", _T19)]

class _V26_2(_c.Structure):
    _fields_ = [("values", _T25)]

class _V26(_c.Union):
    _fields_ = [("case0", _V26_0), ("case1", _V26_1), ("case2", _V26_2)]

class _T26(_c.Structure):
    _fields_ = [("kind", _c.c_uint32), ("cases", _V26)]

class _T27(_c.Structure):
    _fields_ = [("left", _T21), ("right", _T21)]

class _T28(_c.Structure):
    _fields_ = [("unit_value", _c.c_uint8), ("bool_value", _c.c_bool), ("uint8_value", _c.c_uint8), ("uint16_value", _c.c_uint16), ("uint32_value", _c.c_uint32), ("uint64_value", _c.c_uint64), ("int8_value", _c.c_int8), ("int16_value", _c.c_int16), ("int32_value", _c.c_int32), ("int64_value", _c.c_int64), ("nat_value", _T10), ("int_value", _T11), ("float32_value", _c.c_float), ("float64_value", _c.c_double), ("text_value", _T14), ("bytes_value", _T15), ("char_value", _c.c_uint32), ("usize_value", _c.c_uint64), ("isize_value", _c.c_int64), ("digit", _T10)]

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


_clear10 = _LIBRARY["nominalprimitivesubtypes_nat_clear"]
_clear10.argtypes = [_c.POINTER(_T10)]
_clear10.restype = None
_clear11 = _LIBRARY["nominalprimitivesubtypes_int_clear"]
_clear11.argtypes = [_c.POINTER(_T11)]
_clear11.restype = None
_clear14 = _LIBRARY["nominalprimitivesubtypes_string_clear"]
_clear14.argtypes = [_c.POINTER(_T14)]
_clear14.restype = None
_clear15 = _LIBRARY["nominalprimitivesubtypes_bytes_clear"]
_clear15.argtypes = [_c.POINTER(_T15)]
_clear15.restype = None
_clear19 = _LIBRARY["nominalprimitivesubtypes_packet_clear"]
_clear19.argtypes = [_c.POINTER(_T19)]
_clear19.restype = None
_clear20 = _LIBRARY["nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value_clear"]
_clear20.argtypes = [_c.POINTER(_T20)]
_clear20.restype = None
_clear21 = _LIBRARY["nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear"]
_clear21.argtypes = [_c.POINTER(_T21)]
_clear21.restype = None
_clear22 = _LIBRARY["nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear"]
_clear22.argtypes = [_c.POINTER(_T22)]
_clear22.restype = None
_clear23 = _LIBRARY["nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear"]
_clear23.argtypes = [_c.POINTER(_T23)]
_clear23.restype = None
_clear24 = _LIBRARY["nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear"]
_clear24.argtypes = [_c.POINTER(_T24)]
_clear24.restype = None
_clear25 = _LIBRARY["nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span_clear"]
_clear25.argtypes = [_c.POINTER(_T25)]
_clear25.restype = None
_clear26 = _LIBRARY["nominalprimitivesubtypes_event_clear"]
_clear26.argtypes = [_c.POINTER(_T26)]
_clear26.restype = None
_clear27 = _LIBRARY["nominalprimitivesubtypes_pair_clear"]
_clear27.argtypes = [_c.POINTER(_T27)]
_clear27.restype = None
_clear28 = _LIBRARY["nominalprimitivesubtypes_raw_packet_clear"]
_clear28.argtypes = [_c.POINTER(_T28)]
_clear28.restype = None
_fn0 = _LIBRARY["nominalprimitivesubtypes_aliases"]
_fn0.argtypes = [_c.POINTER(_T21), _c.POINTER(_T21), _c.POINTER(_T21), _c.POINTER(_Error)]
_fn0.restype = _c.c_int
_fn1 = _LIBRARY["nominalprimitivesubtypes_combine"]
_fn1.argtypes = [_c.POINTER(_T19), _c.POINTER(_T19), _c.POINTER(_T22), _c.POINTER(_Error)]
_fn1.restype = _c.c_int
_fn2 = _LIBRARY["nominalprimitivesubtypes_echo_a"]
_fn2.argtypes = [_c.POINTER(_T19), _c.POINTER(_T19), _c.POINTER(_Error)]
_fn2.restype = _c.c_int
_fn3 = _LIBRARY["nominalprimitivesubtypes_echo_b"]
_fn3.argtypes = [_c.POINTER(_T19), _c.POINTER(_T19), _c.POINTER(_Error)]
_fn3.restype = _c.c_int
_fn4 = _LIBRARY["nominalprimitivesubtypes_echo_event_a"]
_fn4.argtypes = [_c.POINTER(_T26), _c.POINTER(_T26), _c.POINTER(_Error)]
_fn4.restype = _c.c_int
_fn5 = _LIBRARY["nominalprimitivesubtypes_echo_event_b"]
_fn5.argtypes = [_c.POINTER(_T26), _c.POINTER(_T26), _c.POINTER(_Error)]
_fn5.restype = _c.c_int
_fn6 = _LIBRARY["nominalprimitivesubtypes_echo_pair"]
_fn6.argtypes = [_c.POINTER(_T27), _c.POINTER(_T27), _c.POINTER(_Error)]
_fn6.restype = _c.c_int
_fn7 = _LIBRARY["nominalprimitivesubtypes_produce"]
_fn7.argtypes = [_c.POINTER(_T28), _c.POINTER(_T20), _c.POINTER(_Error)]
_fn7.restype = _c.c_int
_fn8 = _LIBRARY["nominalprimitivesubtypes_produce_choices"]
_fn8.argtypes = [_c.POINTER(_T28), _c.POINTER(_T26), _c.POINTER(_Error)]
_fn8.restype = _c.c_int
_fn9 = _LIBRARY["nominalprimitivesubtypes_produce_event"]
_fn9.argtypes = [_c.POINTER(_T28), _c.POINTER(_T26), _c.POINTER(_Error)]
_fn9.restype = _c.c_int
_fn10 = _LIBRARY["nominalprimitivesubtypes_produce_group"]
_fn10.argtypes = [_c.POINTER(_T28), _c.POINTER(_T21), _c.POINTER(_Error)]
_fn10.restype = _c.c_int
_fn11 = _LIBRARY["nominalprimitivesubtypes_produce_pair"]
_fn11.argtypes = [_c.POINTER(_T28), _c.POINTER(_T27), _c.POINTER(_Error)]
_fn11.restype = _c.c_int
_fn12 = _LIBRARY["nominalprimitivesubtypes_refuse_unit"]
_fn12.argtypes = [_c.POINTER(_T19), _c.POINTER(_T19), _c.POINTER(_Error)]
_fn12.restype = _c.c_int
_fn13 = _LIBRARY["nominalprimitivesubtypes_word_bits"]
_fn13.argtypes = [_c.POINTER(_c.c_uint32), _c.POINTER(_Error)]
_fn13.restype = _c.c_int

def _to0(value, scope):
    scope.charge(1, _c.sizeof(_c.c_uint8))
    if value is not None: raise TypeError("Unit requires None")
    return 0

def _from0(value, scope):
    scope.charge(1, _c.sizeof(_c.c_uint8))
    return None

def _to1(value, scope):
    scope.charge(1, _c.sizeof(_c.c_bool))
    if type(value) is not bool: raise TypeError("Bool requires bool")
    return value

def _from1(value, scope):
    scope.charge(1, _c.sizeof(_c.c_bool))
    return bool(value)

def _to2(value, scope):
    scope.charge(1, _c.sizeof(_c.c_uint8))
    return _integer(value, 0, (1 << 8) - 1)

def _from2(value, scope):
    scope.charge(1, _c.sizeof(_c.c_uint8))
    return value

def _to3(value, scope):
    scope.charge(1, _c.sizeof(_c.c_uint16))
    return _integer(value, 0, (1 << 16) - 1)

def _from3(value, scope):
    scope.charge(1, _c.sizeof(_c.c_uint16))
    return value

def _to4(value, scope):
    scope.charge(1, _c.sizeof(_c.c_uint32))
    return _integer(value, 0, (1 << 32) - 1)

def _from4(value, scope):
    scope.charge(1, _c.sizeof(_c.c_uint32))
    return value

def _to5(value, scope):
    scope.charge(1, _c.sizeof(_c.c_uint64))
    return _integer(value, 0, (1 << 64) - 1)

def _from5(value, scope):
    scope.charge(1, _c.sizeof(_c.c_uint64))
    return value

def _to6(value, scope):
    scope.charge(1, _c.sizeof(_c.c_int8))
    return _integer(value, -(1 << 7), (1 << 7) - 1)

def _from6(value, scope):
    scope.charge(1, _c.sizeof(_c.c_int8))
    return value

def _to7(value, scope):
    scope.charge(1, _c.sizeof(_c.c_int16))
    return _integer(value, -(1 << 15), (1 << 15) - 1)

def _from7(value, scope):
    scope.charge(1, _c.sizeof(_c.c_int16))
    return value

def _to8(value, scope):
    scope.charge(1, _c.sizeof(_c.c_int32))
    return _integer(value, -(1 << 31), (1 << 31) - 1)

def _from8(value, scope):
    scope.charge(1, _c.sizeof(_c.c_int32))
    return value

def _to9(value, scope):
    scope.charge(1, _c.sizeof(_c.c_int64))
    return _integer(value, -(1 << 63), (1 << 63) - 1)

def _from9(value, scope):
    scope.charge(1, _c.sizeof(_c.c_int64))
    return value

def _to10(value, scope):
    scope.charge(1, _c.sizeof(_T10))
    _integer(value, 0, None)
    length = (value.bit_length() + 31) // 32
    scope.charge(length, 4)
    data = abs(value).to_bytes(length * 4, "little")
    return _T10(_buffer(data, scope), length, None, None)

def _from10(value, scope):
    scope.charge(1, _c.sizeof(_T10))
    magnitude = int.from_bytes(_read(value.data, value.length * 4, scope, 2), "little")
    return magnitude

def _to11(value, scope):
    scope.charge(1, _c.sizeof(_T11))
    _integer(value, None, None)
    length = (value.bit_length() + 31) // 32
    scope.charge(length, 4)
    data = abs(value).to_bytes(length * 4, "little")
    return _T11(_buffer(data, scope), length, None, None, value < 0)

def _from11(value, scope):
    scope.charge(1, _c.sizeof(_T11))
    magnitude = int.from_bytes(_read(value.data, value.length * 4, scope, 2), "little")
    return -magnitude if value.negative else magnitude

def _to12(value, scope):
    scope.charge(1, _c.sizeof(_c.c_float))
    if type(value) is not float: raise TypeError("Expected a float, without numeric coercion")
    return _c.c_float(value).value

def _from12(value, scope):
    scope.charge(1, _c.sizeof(_c.c_float))
    return value

def _to13(value, scope):
    scope.charge(1, _c.sizeof(_c.c_double))
    if type(value) is not float: raise TypeError("Expected a float, without numeric coercion")
    return value

def _from13(value, scope):
    scope.charge(1, _c.sizeof(_c.c_double))
    return value

def _to14(value, scope):
    scope.charge(1, _c.sizeof(_T14))
    if type(value) is not str: raise TypeError("Expected str")
    scope.charge(_text_size(value))
    value = value.encode("utf-8", "strict")
    return _T14(_buffer(value, scope), len(value), None, None)

def _from14(value, scope):
    scope.charge(1, _c.sizeof(_T14))
    return _read(value.data, value.length, scope, 4).decode("utf-8", "strict")

def _to15(value, scope):
    scope.charge(1, _c.sizeof(_T15))
    if type(value) is not bytes: raise TypeError("Expected bytes")
    return _T15(_buffer(value, scope), len(value), None, None)

def _from15(value, scope):
    scope.charge(1, _c.sizeof(_T15))
    return _read(value.data, value.length, scope)

def _to16(value, scope):
    scope.charge(1, _c.sizeof(_c.c_uint32))
    if type(value) is not str: raise TypeError("Char requires a string")
    if len(value) != 1 or 0xd800 <= ord(value) <= 0xdfff: raise ValueError("Char requires one Unicode scalar")
    return ord(value)

def _from16(value, scope):
    scope.charge(1, _c.sizeof(_c.c_uint32))
    if value > 0x10ffff or 0xd800 <= value <= 0xdfff: raise LeanBridgeError(5, "Invalid native Unicode scalar")
    return chr(value)

def _to17(value, scope):
    scope.charge(1, _c.sizeof(_c.c_uint64))
    return _integer(value, 0, (1 << 64) - 1)

def _from17(value, scope):
    scope.charge(1, _c.sizeof(_c.c_uint64))
    return value

def _to18(value, scope):
    scope.charge(1, _c.sizeof(_c.c_int64))
    return _integer(value, -(1 << 63), (1 << 63) - 1)

def _from18(value, scope):
    scope.charge(1, _c.sizeof(_c.c_int64))
    return value

def _to19(value, scope):
    scope.charge(1, _c.sizeof(_T19))
    if type(value) is not Packet: raise TypeError("Expected Packet")
    return _T19(_to0(value.unit_value, scope), _to1(value.bool_value, scope), _to2(value.uint8_value, scope), _to3(value.uint16_value, scope), _to4(value.uint32_value, scope), _to5(value.uint64_value, scope), _to6(value.int8_value, scope), _to7(value.int16_value, scope), _to8(value.int32_value, scope), _to9(value.int64_value, scope), _to10(value.nat_value, scope), _to11(value.int_value, scope), _to12(value.float32_value, scope), _to13(value.float64_value, scope), _to14(value.text_value, scope), _to15(value.bytes_value, scope), _to16(value.char_value, scope), _to17(value.usize_value, scope), _to18(value.isize_value, scope), _to10(value.digit, scope))

def _from19(value, scope):
    scope.charge(1, _c.sizeof(_T19))
    return Packet(unit_value=_from0(value.unit_value, scope), bool_value=_from1(value.bool_value, scope), uint8_value=_from2(value.uint8_value, scope), uint16_value=_from3(value.uint16_value, scope), uint32_value=_from4(value.uint32_value, scope), uint64_value=_from5(value.uint64_value, scope), int8_value=_from6(value.int8_value, scope), int16_value=_from7(value.int16_value, scope), int32_value=_from8(value.int32_value, scope), int64_value=_from9(value.int64_value, scope), nat_value=_from10(value.nat_value, scope), int_value=_from11(value.int_value, scope), float32_value=_from12(value.float32_value, scope), float64_value=_from13(value.float64_value, scope), text_value=_from14(value.text_value, scope), bytes_value=_from15(value.bytes_value, scope), char_value=_from16(value.char_value, scope), usize_value=_from17(value.usize_value, scope), isize_value=_from18(value.isize_value, scope), digit=_from10(value.digit, scope))

def _to20(value, scope):
    scope.charge(1, _c.sizeof(_T20))
    if value is None: return _T20()
    if type(value) is not Some: raise TypeError("Option requires None or Some(value)")
    return _T20(1, _to19(value.value, scope))

def _from20(value, scope):
    scope.charge(1, _c.sizeof(_T20))
    if value.has_value > 1: raise LeanBridgeError(5, "Invalid native option flag")
    return Some(_from19(value.value, scope)) if value.has_value else None

def _to21(value, scope):
    scope.charge(1, _c.sizeof(_T21))
    if type(value) not in (tuple, list): raise TypeError("Expected a tuple or list")
    scope.charge(len(value), 8)
    value = tuple(value)
    memory = scope.allocate(_T20, len(value))
    for index, item in enumerate(value):
        memory[index] = _to20(item, scope)
    return _T21(_c.addressof(memory) if len(value) else None, len(value), None, None)

def _from21(value, scope):
    scope.charge(1, _c.sizeof(_T21))
    scope.charge(value.length, max(8, _c.sizeof(_T20)))
    if value.length and not value.data: raise LeanBridgeError(5, "Native array has a missing buffer")
    if value.length and value.data % _c.alignment(_T20): raise LeanBridgeError(5, "Native array has a misaligned buffer")
    memory = (_T20 * value.length).from_address(value.data) if value.length else ()
    return tuple(_from20(item, scope) for item in memory)

def _to22(value, scope):
    scope.charge(1, _c.sizeof(_T22))
    if type(value) is not tuple: raise TypeError("Prod requires a two-element tuple")
    if len(value) != 2: raise ValueError("Prod requires exactly two elements")
    return _T22(_to19(value[0], scope), _to19(value[1], scope))

def _from22(value, scope):
    scope.charge(1, _c.sizeof(_T22))
    return (_from19(value.fst, scope), _from19(value.snd, scope))

def _to23(value, scope):
    scope.charge(1, _c.sizeof(_T23))
    if type(value) is Ok: return _T23(is_ok=1, ok=_to19(value.value, scope))
    if type(value) is Err: return _T23(error=_to19(value.value, scope))
    raise TypeError("Result requires Ok(value) or Err(value)")

def _from23(value, scope):
    scope.charge(1, _c.sizeof(_T23))
    if value.is_ok > 1: raise LeanBridgeError(5, "Invalid native result flag")
    return Ok(_from19(value.ok, scope)) if value.is_ok else Err(_from19(value.error, scope))

def _to24(value, scope):
    scope.charge(1, _c.sizeof(_T24))
    if value is None: return _T24()
    if type(value) is not Some: raise TypeError("Option requires None or Some(value)")
    return _T24(1, _to23(value.value, scope))

def _from24(value, scope):
    scope.charge(1, _c.sizeof(_T24))
    if value.has_value > 1: raise LeanBridgeError(5, "Invalid native option flag")
    return Some(_from23(value.value, scope)) if value.has_value else None

def _to25(value, scope):
    scope.charge(1, _c.sizeof(_T25))
    if type(value) not in (tuple, list): raise TypeError("Expected a tuple or list")
    scope.charge(len(value), 8)
    value = tuple(value)
    memory = scope.allocate(_T24, len(value))
    for index, item in enumerate(value):
        memory[index] = _to24(item, scope)
    return _T25(_c.addressof(memory) if len(value) else None, len(value), None, None)

def _from25(value, scope):
    scope.charge(1, _c.sizeof(_T25))
    scope.charge(value.length, max(8, _c.sizeof(_T24)))
    if value.length and not value.data: raise LeanBridgeError(5, "Native array has a missing buffer")
    if value.length and value.data % _c.alignment(_T24): raise LeanBridgeError(5, "Native array has a misaligned buffer")
    memory = (_T24 * value.length).from_address(value.data) if value.length else ()
    return tuple(_from24(item, scope) for item in memory)

def _to26(value, scope):
    scope.charge(1, _c.sizeof(_T26))
    if type(value) is EventEmpty:
        return _T26(kind=0, cases=_V26(case0=_V26_0()))
    if type(value) is EventBox:
        return _T26(kind=1, cases=_V26(case1=_V26_1(value=_to19(value.value, scope))))
    if type(value) is EventChoices:
        return _T26(kind=2, cases=_V26(case2=_V26_2(values=_to25(value.values, scope))))
    raise TypeError("Expected a named Event constructor")

def _from26(value, scope):
    scope.charge(1, _c.sizeof(_T26))
    if value.kind == 0:
        return EventEmpty()
    if value.kind == 1:
        return EventBox(value=_from19(value.cases.case1.value, scope))
    if value.kind == 2:
        return EventChoices(values=_from25(value.cases.case2.values, scope))
    raise LeanBridgeError(5, "Invalid native Event constructor")

def _to27(value, scope):
    scope.charge(1, _c.sizeof(_T27))
    if type(value) is not Pair: raise TypeError("Expected Pair")
    return _T27(_to21(value.left, scope), _to21(value.right, scope))

def _from27(value, scope):
    scope.charge(1, _c.sizeof(_T27))
    return Pair(left=_from21(value.left, scope), right=_from21(value.right, scope))

def _to28(value, scope):
    scope.charge(1, _c.sizeof(_T28))
    if type(value) is not RawPacket: raise TypeError("Expected RawPacket")
    return _T28(_to0(value.unit_value, scope), _to1(value.bool_value, scope), _to2(value.uint8_value, scope), _to3(value.uint16_value, scope), _to4(value.uint32_value, scope), _to5(value.uint64_value, scope), _to6(value.int8_value, scope), _to7(value.int16_value, scope), _to8(value.int32_value, scope), _to9(value.int64_value, scope), _to10(value.nat_value, scope), _to11(value.int_value, scope), _to12(value.float32_value, scope), _to13(value.float64_value, scope), _to14(value.text_value, scope), _to15(value.bytes_value, scope), _to16(value.char_value, scope), _to17(value.usize_value, scope), _to18(value.isize_value, scope), _to10(value.digit, scope))

def _from28(value, scope):
    scope.charge(1, _c.sizeof(_T28))
    return RawPacket(unit_value=_from0(value.unit_value, scope), bool_value=_from1(value.bool_value, scope), uint8_value=_from2(value.uint8_value, scope), uint16_value=_from3(value.uint16_value, scope), uint32_value=_from4(value.uint32_value, scope), uint64_value=_from5(value.uint64_value, scope), int8_value=_from6(value.int8_value, scope), int16_value=_from7(value.int16_value, scope), int32_value=_from8(value.int32_value, scope), int64_value=_from9(value.int64_value, scope), nat_value=_from10(value.nat_value, scope), int_value=_from11(value.int_value, scope), float32_value=_from12(value.float32_value, scope), float64_value=_from13(value.float64_value, scope), text_value=_from14(value.text_value, scope), bytes_value=_from15(value.bytes_value, scope), char_value=_from16(value.char_value, scope), usize_value=_from17(value.usize_value, scope), isize_value=_from18(value.isize_value, scope), digit=_from10(value.digit, scope))


def _call0(_arg0, _arg1):
    _ensure_process()
    scope = _Scope()
    output = _T21()
    error = _Error()
    try:
        input0 = _to21(_arg0, scope)
        input1 = _to21(_arg1, scope)
        _check(_fn0(_c.byref(input0), _c.byref(input1), _c.byref(output), _c.byref(error)), error, scope)
        return _from21(output, scope)
    finally:
        try:
            _clear21(_c.byref(output))
        finally:
            scope.close()

def _call1(_arg0, _arg1):
    _ensure_process()
    scope = _Scope()
    output = _T22()
    error = _Error()
    try:
        input0 = _to19(_arg0, scope)
        input1 = _to19(_arg1, scope)
        _check(_fn1(_c.byref(input0), _c.byref(input1), _c.byref(output), _c.byref(error)), error, scope)
        return _from22(output, scope)
    finally:
        try:
            _clear22(_c.byref(output))
        finally:
            scope.close()

def _call2(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T19()
    error = _Error()
    try:
        input0 = _to19(_arg0, scope)
        _check(_fn2(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from19(output, scope)
    finally:
        try:
            _clear19(_c.byref(output))
        finally:
            scope.close()

def _call3(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T19()
    error = _Error()
    try:
        input0 = _to19(_arg0, scope)
        _check(_fn3(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from19(output, scope)
    finally:
        try:
            _clear19(_c.byref(output))
        finally:
            scope.close()

def _call4(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T26()
    error = _Error()
    try:
        input0 = _to26(_arg0, scope)
        _check(_fn4(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from26(output, scope)
    finally:
        try:
            _clear26(_c.byref(output))
        finally:
            scope.close()

def _call5(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T26()
    error = _Error()
    try:
        input0 = _to26(_arg0, scope)
        _check(_fn5(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from26(output, scope)
    finally:
        try:
            _clear26(_c.byref(output))
        finally:
            scope.close()

def _call6(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T27()
    error = _Error()
    try:
        input0 = _to27(_arg0, scope)
        _check(_fn6(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from27(output, scope)
    finally:
        try:
            _clear27(_c.byref(output))
        finally:
            scope.close()

def _call7(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T20()
    error = _Error()
    try:
        input0 = _to28(_arg0, scope)
        _check(_fn7(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from20(output, scope)
    finally:
        try:
            _clear20(_c.byref(output))
        finally:
            scope.close()

def _call8(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T26()
    error = _Error()
    try:
        input0 = _to28(_arg0, scope)
        _check(_fn8(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from26(output, scope)
    finally:
        try:
            _clear26(_c.byref(output))
        finally:
            scope.close()

def _call9(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T26()
    error = _Error()
    try:
        input0 = _to28(_arg0, scope)
        _check(_fn9(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from26(output, scope)
    finally:
        try:
            _clear26(_c.byref(output))
        finally:
            scope.close()

def _call10(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T21()
    error = _Error()
    try:
        input0 = _to28(_arg0, scope)
        _check(_fn10(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from21(output, scope)
    finally:
        try:
            _clear21(_c.byref(output))
        finally:
            scope.close()

def _call11(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T27()
    error = _Error()
    try:
        input0 = _to28(_arg0, scope)
        _check(_fn11(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from27(output, scope)
    finally:
        try:
            _clear27(_c.byref(output))
        finally:
            scope.close()

def _call12(_arg0):
    _ensure_process()
    scope = _Scope()
    output = _T19()
    error = _Error()
    try:
        input0 = _to19(_arg0, scope)
        _check(_fn12(_c.byref(input0), _c.byref(output), _c.byref(error)), error, scope)
        return _from19(output, scope)
    finally:
        try:
            _clear19(_c.byref(output))
        finally:
            scope.close()

def _call13():
    _ensure_process()
    scope = _Scope()
    output = _c.c_uint32()
    error = _Error()
    try:

        _check(_fn13(_c.byref(output), _c.byref(error)), error, scope)
        return _from4(output.value, scope)
    finally:
        try:
            pass
        finally:
            scope.close()
