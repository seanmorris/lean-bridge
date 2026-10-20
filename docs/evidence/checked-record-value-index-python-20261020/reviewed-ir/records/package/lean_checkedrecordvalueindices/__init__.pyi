from __future__ import annotations
from dataclasses import dataclass as _dataclass

__all__ = ("LeanBridgeError", "Ab", "EmptySized", "EmptyToken", "Off", "On", "UnicodeToken", "WideToken", "ZeroToken", "ab_string_index", "empty_sized_index", "empty_string_index", "false_bool_index", "produce_ab", "produce_empty_sized", "produce_empty_string", "produce_false_bool", "produce_true_bool", "produce_unicode_string", "produce_wide_nat", "produce_zero_nat", "true_bool_index", "unicode_string_index", "wide_nat_index", "zero_nat_index",)

class LeanBridgeError(RuntimeError):
    status: int
    def __init__(self, status: int, message: str):
        ...



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

def ab_string_index(value0: Ab) -> int:
    """Checked Lean Fin bounds: value0 checked by CheckedRecordValueIndices.mkAb."""
    ...

def empty_sized_index(value0: EmptySized) -> int:
    """Checked Lean Fin bounds: value0 checked by CheckedRecordValueIndices.mkEmptySized."""
    ...

def empty_string_index(value0: EmptyToken) -> int:
    """Checked Lean Fin bounds: value0 checked by CheckedRecordValueIndices.mkEmptyToken."""
    ...

def false_bool_index(value0: Off) -> int:
    """Checked Lean Fin bounds: value0 checked by CheckedRecordValueIndices.mkOff."""
    ...

def produce_ab() -> Ab:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    ...

def produce_empty_sized() -> EmptySized:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    ...

def produce_empty_string(value0: int) -> EmptyToken:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    ...

def produce_false_bool() -> Off:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    ...

def produce_true_bool() -> On:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    ...

def produce_unicode_string(value0: int) -> UnicodeToken:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    ...

def produce_wide_nat(value0: int) -> WideToken:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    ...

def produce_zero_nat(value0: int) -> ZeroToken:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    ...

def true_bool_index(value0: On) -> int:
    """Checked Lean Fin bounds: value0 checked by CheckedRecordValueIndices.mkOn."""
    ...

def unicode_string_index(value0: UnicodeToken) -> int:
    """Checked Lean Fin bounds: value0 checked by CheckedRecordValueIndices.mkUnicodeToken."""
    ...

def wide_nat_index(value0: WideToken) -> int:
    """Checked Lean Fin bounds: value0 checked by CheckedRecordValueIndices.mkWideToken."""
    ...

def zero_nat_index(value0: ZeroToken) -> int:
    """Checked Lean Fin bounds: value0 checked by CheckedRecordValueIndices.mkZeroToken."""
    ...

