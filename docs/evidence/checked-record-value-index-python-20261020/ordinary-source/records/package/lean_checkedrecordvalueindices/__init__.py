from __future__ import annotations
from dataclasses import dataclass as _dataclass

__all__ = ("LeanBridgeError", "Ab", "EmptySized", "EmptyToken", "Off", "On", "UnicodeToken", "WideToken", "ZeroToken", "ab_string_index", "empty_sized_index", "empty_string_index", "false_bool_index", "produce_ab", "produce_empty_sized", "produce_empty_string", "produce_false_bool", "produce_true_bool", "produce_unicode_string", "produce_wide_nat", "produce_zero_nat", "true_bool_index", "unicode_string_index", "wide_nat_index", "zero_nat_index",)

class LeanBridgeError(RuntimeError):
    status: int
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status



@_dataclass(frozen=True, slots=True)
class Ab:
    size: int

_Array2 = tuple[int, ...] | list[int]

@_dataclass(frozen=True, slots=True)
class EmptySized:
    data: _Array2

@_dataclass(frozen=True, slots=True)
class EmptyToken:
    count: int

@_dataclass(frozen=True, slots=True)
class Off:
    count: int

@_dataclass(frozen=True, slots=True)
class On:
    count: int

@_dataclass(frozen=True, slots=True)
class UnicodeToken:
    count: int

@_dataclass(frozen=True, slots=True)
class WideToken:
    count: int

@_dataclass(frozen=True, slots=True)
class ZeroToken:
    count: int

def ab_string_index(arg0: Ab) -> int:
    """Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkAb."""
    return _native._call0(arg0)

def empty_sized_index(arg0: EmptySized) -> int:
    """Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkEmptySized."""
    return _native._call1(arg0)

def empty_string_index(arg0: EmptyToken) -> int:
    """Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkEmptyToken."""
    return _native._call2(arg0)

def false_bool_index(arg0: Off) -> int:
    """Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkOff."""
    return _native._call3(arg0)

def produce_ab() -> Ab:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    return _native._call4()

def produce_empty_sized() -> EmptySized:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    return _native._call5()

def produce_empty_string(arg0: int) -> EmptyToken:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    return _native._call6(arg0)

def produce_false_bool() -> Off:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    return _native._call7()

def produce_true_bool() -> On:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    return _native._call8()

def produce_unicode_string(arg0: int) -> UnicodeToken:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    return _native._call9(arg0)

def produce_wide_nat(arg0: int) -> WideToken:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    return _native._call10(arg0)

def produce_zero_nat(arg0: int) -> ZeroToken:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    return _native._call11(arg0)

def true_bool_index(arg0: On) -> int:
    """Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkOn."""
    return _native._call12(arg0)

def unicode_string_index(arg0: UnicodeToken) -> int:
    """Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkUnicodeToken."""
    return _native._call13(arg0)

def wide_nat_index(arg0: WideToken) -> int:
    """Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkWideToken."""
    return _native._call14(arg0)

def zero_nat_index(arg0: ZeroToken) -> int:
    """Checked Lean Fin bounds: arg0 checked by CheckedRecordValueIndices.mkZeroToken."""
    return _native._call15(arg0)

from . import _native
