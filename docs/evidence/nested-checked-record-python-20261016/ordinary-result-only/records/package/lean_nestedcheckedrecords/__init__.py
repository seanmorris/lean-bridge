from __future__ import annotations
from dataclasses import dataclass as _dataclass

__all__ = ("LeanBridgeError", "Some", "Option", "Packet", "produce_array", "produce_option",)

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


@_dataclass(frozen=True, slots=True)
class Packet:
    digit: int
    word: int

_Array2 = tuple[Packet, ...] | list[Packet]

def produce_array(arg0: int) -> tuple[Packet, ...]:
    """Checked Lean Fin bounds: result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value."""
    return _native._call0(arg0)

def produce_option(arg0: int) -> Option[Packet]:
    """Checked Lean Fin bounds: result? projects proof-backed record payload fields; result?.digit < 10; result?.word projects the Subtype base value."""
    return _native._call1(arg0)

from . import _native
