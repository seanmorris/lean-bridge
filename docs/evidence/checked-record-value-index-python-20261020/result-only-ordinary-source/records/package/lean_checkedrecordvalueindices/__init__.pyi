from __future__ import annotations
from dataclasses import dataclass as _dataclass

__all__ = ("LeanBridgeError", "Ab", "EmptySized", "EmptyToken", "Off", "On", "UnicodeToken", "WideToken", "ZeroToken", "produce_ab", "produce_empty_sized", "produce_empty_string", "produce_false_bool", "produce_true_bool", "produce_unicode_string", "produce_wide_nat", "produce_zero_nat",)

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

def produce_ab() -> Ab:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    ...

def produce_empty_sized() -> EmptySized:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    ...

def produce_empty_string(arg0: int) -> EmptyToken:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    ...

def produce_false_bool() -> Off:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    ...

def produce_true_bool() -> On:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    ...

def produce_unicode_string(arg0: int) -> UnicodeToken:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    ...

def produce_wide_nat(arg0: int) -> WideToken:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    ...

def produce_zero_nat(arg0: int) -> ZeroToken:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    ...

