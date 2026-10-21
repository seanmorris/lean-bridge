from __future__ import annotations
from dataclasses import dataclass as _dataclass

__all__ = ("LeanBridgeError", "Some", "Option", "Witness", "Mark", "MarkBlank", "MarkMarked", "Marker", "Token", "maybe_witness", "produce_mark", "produce_marker", "produce_token", "produce_witness", "witnesses",)

class LeanBridgeError(RuntimeError):
    status: int
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


from typing import Generic as _Generic, TypeVar as _TypeVar

_T = _TypeVar("_T", covariant=True)
_E = _TypeVar("_E", covariant=True)

@_dataclass(frozen=True)
class Some(_Generic[_T]):
    value: _T

Option = Some[_T] | None


from typing import ClassVar as _ClassVar, Literal as _Literal, TypeAlias as _TypeAlias

@_dataclass(frozen=True, slots=True)
class Witness:
    pass

@_dataclass(frozen=True, slots=True)
class MarkBlank:
    kind: _ClassVar[_Literal["blank"]] = "blank"


@_dataclass(frozen=True, slots=True)
class MarkMarked:
    kind: _ClassVar[_Literal["marked"]] = "marked"
    witness: Witness

Mark: _TypeAlias = MarkBlank | MarkMarked

@_dataclass(frozen=True, slots=True)
class Marker:
    pass

@_dataclass(frozen=True, slots=True)
class Token:
    tag: None

_Array8 = tuple[Witness, ...] | list[Witness]

def maybe_witness(arg0: bool) -> Option[Witness]:
    """Checked Lean Fin bounds: result? projects proof-backed record payload fields."""
    return _native._call0(arg0)

def produce_mark(arg0: bool) -> Mark:
    """Checked Lean Fin bounds: result.marked.witness projects proof-backed record payload fields."""
    return _native._call1(arg0)

def produce_marker() -> Marker:
    return _native._call2()

def produce_token() -> Token:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    return _native._call3()

def produce_witness() -> Witness:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields."""
    return _native._call4()

def witnesses(arg0: int) -> tuple[Witness, ...]:
    """Checked Lean Fin bounds: result[*] projects proof-backed record payload fields."""
    return _native._call5(arg0)

from . import _native
